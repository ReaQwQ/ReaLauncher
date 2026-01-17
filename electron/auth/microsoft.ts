import { app, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { MicrosoftAuth as EMLMicrosoftAuth } from 'eml-lib'

export interface MinecraftProfile {
    id: string
    name: string
    accessToken: string
    uuid?: string
    refreshToken?: string
    clientToken?: string
}

interface CachedAuth {
    profile: MinecraftProfile
    account: any
    expiresAt: number
}

let mainWindow: Electron.BrowserWindow | null = null

export function setAuthWindow(window: Electron.BrowserWindow) {
    mainWindow = window
}

class MicrosoftAuth {
    private cachePath: string
    private cachedAuth: CachedAuth | null = null

    private clientId: string = process.env.AZURE_CLIENT_ID || '499546d9-bbfe-4b9b-a086-eb3d75afb78f'
    private tenant: string = 'consumers'

    constructor() {
        this.cachePath = path.join(app.getPath('userData'), 'eml-auth-cache.json')
        this.loadCache()
    }

    private loadCache(): void {
        try {
            if (fs.existsSync(this.cachePath)) {
                this.cachedAuth = JSON.parse(fs.readFileSync(this.cachePath, 'utf-8'))
            }
        } catch (error) {
            console.error('Failed to load auth cache:', error)
        }
    }

    private saveCache(auth: CachedAuth): void {
        try {
            fs.writeFileSync(this.cachePath, JSON.stringify(auth))
            this.cachedAuth = auth
        } catch (error) {
            console.error('Failed to save auth cache:', error)
        }
    }

    async getProfile(): Promise<MinecraftProfile | null> {
        if (!this.cachedAuth) return null
        if (this.cachedAuth.expiresAt > Date.now()) return this.cachedAuth.profile

        try {
            console.log('[Auth] Validating cached session...')
            const emlAuth = new (EMLMicrosoftAuth as any)(null, this.clientId)
            if (await emlAuth.validate(this.cachedAuth.account)) return this.cachedAuth.profile

            console.log('[Auth] Refreshing session...')
            const refreshed = await emlAuth.refresh(this.cachedAuth.account)
            const profile = this.accountToProfile(refreshed)
            this.saveCache({ profile, account: refreshed, expiresAt: Date.now() + (23 * 60 * 60 * 1000) })
            return profile
        } catch (error) {
            console.error('[Auth] Refresh failed:', error)
            return null
        }
    }

    private accountToProfile(account: any): MinecraftProfile {
        return {
            id: account.uuid || account.id,
            name: account.name,
            accessToken: account.accessToken || account.access_token,
            uuid: account.uuid,
            refreshToken: account.refreshToken,
            clientToken: account.clientToken
        }
    }

    async login(): Promise<{ success: boolean; error?: string; profile?: MinecraftProfile }> {
        try {
            console.log('[Auth] Starting Device Code Login Flow...')
            const deviceCodeReq = await fetch(`https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/devicecode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    scope: 'XboxLive.signin offline_access'
                }).toString()
            })

            if (!deviceCodeReq.ok) {
                const errText = await deviceCodeReq.text()
                throw new Error(`Device code request failed: ${deviceCodeReq.status} ${errText}`)
            }

            const deviceCodeData = await deviceCodeReq.json()
            const { device_code, user_code, verification_uri, expires_in, interval } = deviceCodeData

            console.log('[Auth] Opening external browser for verification...')
            shell.openExternal(verification_uri)

            if (mainWindow) {
                mainWindow.webContents.send('auth:device-code', {
                    userCode: user_code,
                    verificationUri: verification_uri
                })
            }

            console.log('[Auth] Polling for token...')
            const token = await this.pollForToken(deviceCodeData.device_code, deviceCodeData.interval, deviceCodeData.expires_in)

            if (!token) return { success: false, error: 'Authentication timed out or cancelled' }

            console.log('[Auth] Token acquired, checking Minecraft account...')
            const emlAuth = new (EMLMicrosoftAuth as any)(null, this.clientId)
            const account = await emlAuth.getAccount(token)
            const profile = this.accountToProfile(account)

            this.saveCache({ profile, account, expiresAt: Date.now() + (23 * 60 * 60 * 1000) })

            return { success: true, profile }
        } catch (error) {
            console.error('[Auth] Login error:', error)
            return { success: false, error: String(error) }
        }
    }

    private async pollForToken(deviceCode: string, interval: number, expiresIn: number): Promise<any | null> {
        const startTime = Date.now()
        const waitMs = (interval || 5) * 1000

        while (Date.now() - startTime < expiresIn * 1000) {
            const tokenReq = await fetch(`https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                    client_id: this.clientId,
                    device_code: deviceCode
                }).toString()
            })

            const data = await tokenReq.json()

            if (tokenReq.ok) return data

            if (data.error === 'authorization_pending') {
                await new Promise(r => setTimeout(r, waitMs))
            } else {
                console.error('[Auth] Polling error:', data.error)
                return null
            }
        }
        return null
    }

    async logout(): Promise<{ success: boolean }> {
        this.cachedAuth = null
        if (fs.existsSync(this.cachePath)) fs.unlinkSync(this.cachePath)
        return { success: true }
    }
}

export const microsoftAuth = new MicrosoftAuth()
