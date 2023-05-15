# CCV PWA Integration Cartridge
A cartridge containing scripts for the integration of the CCV payment processor
with the headless pwa-kit.

## Requirements
-   Node 14
-   npm 6.14.4 or later

## Get Started
1. Run npm install in the root directory
2. Upload the cartridges to BM in your preferred way (e.g. Prophet debugger addon for VSCode )
3. Add "int_ccv" to the site cartridges path ((BM -> Administration -> Sites -> your site -> Settings))
4. Add "bm_ccv:int_ccv" to the BM cartridges path (BM -> Administration -> Sites -> Manage the Business Manager site)
5. In site-import-data/sites rename the RefArch directory to the name of your site
6. Import site-import-data to BM via Site Import

# Unit tests
```npm run test```