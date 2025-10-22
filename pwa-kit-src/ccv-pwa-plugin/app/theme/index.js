import {overrides as baseOverrides} from '@salesforce/retail-react-app/app/theme/index'
import {extendTheme} from '@salesforce/retail-react-app/app/components/shared/ui'

import IdealFastButton from './components/project/ideal-fast-button'
import BancontactModal from './components/project/bancontact-modal'

export const overrides = {
    ...baseOverrides,
    components: {
        ...baseOverrides.components,
        IdealFastButton,
        BancontactModal
    }
}

export default extendTheme(overrides)
