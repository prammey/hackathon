/** Values injected at build time by scripts/build.mjs. None of these are secrets. */
declare const __PRISM_VERSION__: string;
declare const __PRISM_HOSTED_URL__: string;
declare const __PRISM_TEST__: boolean;

declare module "*.png" {
  const url: string;
  export default url;
}

declare module "*.css" {
  const css: string;
  export default css;
}
