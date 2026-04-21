declare module 'ansi-to-html' {
  interface Options {
    fg?: string
    bg?: string
    newline?: boolean
    escapeXML?: boolean
    stream?: boolean
  }
  export default class Convert {
    constructor(options?: Options)
    toHtml(ansi: string): string
  }
}
