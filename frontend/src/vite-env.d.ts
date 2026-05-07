/// <reference types="vite/client" />

// Asset URL imports (Vite ?url suffix)
declare module '*.otf?url' {
  const src: string
  export default src
}
declare module '*.ttf?url' {
  const src: string
  export default src
}
declare module '*.woff2?url' {
  const src: string
  export default src
}
