import React from 'react'
import {useIntl} from 'react-intl'
import {Box, Stack} from '@chakra-ui/react'
import {Controller} from 'react-hook-form'
import CCRadioGroupCCV from '../cc-radio-group-ccv'

import Field from '../../../../../app/components/field'
import {useCCVPayment} from '../../util/ccv-context'

export const CreditCardOptions = function () {
    const {formatMessage} = useIntl()
    const {form, onPaymentIdChange, togglePaymentEdit, isEditingPayment} = useCCVPayment()

    const saveCardCheckbox = {
        name: `saveCard`,
        defaultValue: '',
        inputProps: {disabled: form.watch('paymentInstrumentId') !== 'new_card'},
        type: 'checkbox',
        control: form.control,
        label: formatMessage({
            defaultMessage: 'Save card for later.',
            id: 'payment_selection.message.save_card_for_later'
        })
    }
    return (
        <Box p={[4, 4, 6]} borderBottom="1px solid" borderColor="gray.100">
            <Stack spacing={6}>
                <Controller
                    name="paymentInstrumentId"
                    defaultValue=""
                    control={form.control}
                    rules={{
                        required: formatMessage({
                            defaultMessage: 'Please select a payment method.',
                            id: 'payment_selection.message.select_payment_method'
                        })
                    }}
                    render={({value}) => (
                        <CCRadioGroupCCV
                            form={form}
                            value={value}
                            isEditingPayment={isEditingPayment}
                            togglePaymentEdit={togglePaymentEdit}
                            onPaymentIdChange={onPaymentIdChange}
                        />
                    )}
                />
            </Stack>
            <Box py="20px">
                <Field {...saveCardCheckbox} />
            </Box>
        </Box>
    )
}
