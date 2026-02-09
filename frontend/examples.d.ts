/**
 * TypeScript declarations for raw code example imports.
 * Webpack is configured to import .txt files from examples/ as raw strings.
 * Example files use .txt extension to avoid TypeScript compilation.
 * 
 * This wildcard declaration covers all .txt files in the examples/ directory.
 */

declare module '@/examples/*.txt' {
  const content: string;
  export default content;
}

// Support for require.context used in CodeSnippet.tsx
declare const require: {
  context(
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp
  ): {
    keys(): string[];
    <T>(id: string): T;
  };
};
