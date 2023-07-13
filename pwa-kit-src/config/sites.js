// Provide the sites for your app. Each site includes site id, and its localization configuration.
// You can also provide aliases for your locale. They will be used in place of your locale id when generating paths across the app
module.exports = [
    {
        id: 'RefArch',
        l10n: {
            supportedCurrencies: ['EUR'],
            defaultCurrency: 'EUR',
            defaultLocale: 'en-US',
            supportedLocales: [
                {
                    id: 'en-US',
                    preferredCurrency: 'EUR'
                },
                {
                    id: 'nl-BE',
                    preferredCurrency: 'EUR'
                }
            ]
        }
    }
]
