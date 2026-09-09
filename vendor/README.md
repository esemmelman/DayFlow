`chrono-en.min.js` bundles the English locale of chrono-node 2.10.0 (MIT).
Its license is in chrono-LICENSE.txt. Source: https://github.com/wanasit/chrono

Rebuild with chrono-node 2.10.0 and esbuild 0.25.12 installed:

```sh
esbuild node_modules/chrono-node/dist/esm/locales/en/index.js --bundle --minify --format=iife --global-name=chrono --outfile=vendor/chrono-en.min.js
```

The bundle is committed so DayFlow remains a static site without a build step.
