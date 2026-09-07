import {overrides as baseOverrides} from '@salesforce/retail-react-app/app/theme/index'
import {extendTheme} from '@salesforce/retail-react-app/app/components/shared/ui'

import IdealFastButton from './components/project/ideal-fast-button'

export const overrides = {
    ...baseOverrides,
    components: {
        ...baseOverrides.components,
        IdealFastButton: IdealFastButton
    }
}

export default extendTheme(overrides)
