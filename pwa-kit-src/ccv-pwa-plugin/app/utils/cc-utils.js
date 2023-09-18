export * from '@salesforce/retail-react-app/app/utils/cc-utils'

import {
    AmexIcon,
    DiscoverIcon,
    MastercardIcon,
    VisaIcon,
    BanContactIcon
} from '../components/icons'

/**
 * Returns the icon component for a given card type
 * @param {string} type - The card type
 * @returns {Function|undefined} React component
 */
export const getCreditCardIcon = (type) => {
    if (!type) {
        return undefined
    }
    return {
        // Visa
        visa: VisaIcon,

        // MasterCard
        mastercard: MastercardIcon,
        'master card': MastercardIcon,

        // American Express
        'american express': AmexIcon,
        'american-express': AmexIcon,
        amex: AmexIcon,
        bcmc: BanContactIcon,

        // Discover
        discover: DiscoverIcon
    }[type.toLowerCase()]
}