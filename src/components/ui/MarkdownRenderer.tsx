import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

interface MarkdownRendererProps {
    content: string
    className?: string
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    return (
        <div className={`markdown-body prose prose-invert max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                    img: ({ node, ...props }) => (
                        <img
                            {...props}
                            className="rounded-lg shadow-lg border border-dark-700/50 my-4 max-w-full hover:scale-[1.01] transition-transform cursor-pointer"
                            loading="lazy"
                        />
                    ),
                    a: ({ node, ...props }) => (
                        <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-400 hover:text-primary-300 transition-colors font-medium border-b border-primary-400/30 hover:border-primary-400/60 no-underline"
                        />
                    ),
                    p: ({ node, ...props }) => (
                        <p {...props} className="mb-4 text-dark-200 leading-relaxed" />
                    ),
                    h1: ({ node, ...props }) => <h1 {...props} className="text-2xl font-bold text-dark-100 mt-8 mb-4 flex items-center gap-2" />,
                    h2: ({ node, ...props }) => <h2 {...props} className="text-xl font-bold text-dark-100 mt-6 mb-3 border-b border-dark-700/50 pb-2" />,
                    h3: ({ node, ...props }) => <h3 {...props} className="text-lg font-bold text-dark-100 mt-4 mb-2" />,
                    ul: ({ node, ...props }) => <ul {...props} className="list-disc list-inside mb-4 space-y-1 text-dark-300" />,
                    ol: ({ node, ...props }) => <ol {...props} className="list-decimal list-inside mb-4 space-y-1 text-dark-300" />,
                    code: ({ node, inline, ...props }: any) => (
                        inline
                            ? <code {...props} className="bg-dark-800 text-primary-300 px-1.5 py-0.5 rounded text-sm font-mono" />
                            : <code {...props} className="block bg-dark-900 text-dark-200 p-4 rounded-lg font-mono text-sm overflow-x-auto border border-dark-800" />
                    ),
                    blockquote: ({ node, ...props }) => (
                        <blockquote {...props} className="border-l-4 border-primary-500/50 bg-primary-500/5 pl-4 py-1 my-4 italic text-dark-400" />
                    )
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
