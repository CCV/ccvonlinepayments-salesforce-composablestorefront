import React from 'react'
import {useIntl} from 'react-intl'
import {Box} from '@chakra-ui/react'
import Field from '@salesforce/retail-react-app/app/components/field'

import {useCCVPayment} from '../../util/ccv-context'

export const GiropayOptions = () => {
    const {formatMessage} = useIntl()
    const {form, paymentMethodsMap} = useCCVPayment()
    const selectedMethodData = paymentMethodsMap['CCV_GIROPAY']

    const options = selectedMethodData?.c_ccvOptions || []
    const selectOptions = options.map((option) => {
        return {value: option.issuerid, label: option.issuerdescription}
    })

    const issuerField = {
        name: `ccvIssuerID`,
        defaultValue: '',
        type: 'select',
        options: [
            {
                value: '',
                label: formatMessage({
                    defaultMessage: 'Select your bank.',
                    id: 'payment_selection.message.select_bank'
                })
            },
            ...selectOptions
        ],
        rules: {
            required: formatMessage({
                defaultMessage: 'Please select an option.',
                id: 'payment_selection.message.select_payment_method_option'
            })
        },
        error: form.formState.errors.ccvIssuerID,
        control: form.control
    }

    return (
        <Box padding="20px" data-testid="options-giropay">
            <Field {...issuerField} />
        </Box>
    )
}
