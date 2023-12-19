import React from 'react'

import PropTypes from 'prop-types'
import {Box, Radio, Stack, Spacer} from '@chakra-ui/react'

import {GiropayOptions} from './payment-method-options/options-giropay'
import {IdealOptions} from './payment-method-options/options-ideal'
import {CreditCardInlineOptions} from './payment-method-options/options-cc-inline'
import {useCCVPayment} from '../util/ccv-context'
import {PaymentMethodIcons} from '../util/payment-components-ccv'

export const CCVPaymentMethodRadio = function ({paymentMethod, isSelected}) {
    const {applePayLoaded} = useCCVPayment()

    if (paymentMethod.id === 'CCV_APPLE_PAY') {
        if (!applePayLoaded || !('ApplePaySession' in window)) {
            return null
        }

        if (
            applePayLoaded &&
            'ApplePaySession' in window &&
            !window.ApplePaySession.canMakePayments()
        ) {
            return null
        }
    }

    return (
        <Box border="1px solid" borderColor="gray.100" rounded="base">
            {/* payment method heading row */}
            <Box bg="gray.50" py={3} px={[4, 4, 6]}>
                <Radio value={paymentMethod.id} alignItems="center">
                    <Stack direction="row" align="center">
                        <Box>{paymentMethod.name}</Box>
                        <Spacer />
                        <PaymentMethodIcons paymentMethodId={paymentMethod.id} iconHeight="28px" />
                    </Stack>
                </Radio>
            </Box>
            {isSelected && (
                <>
                    <CCVMethodOptions paymentMethodId={paymentMethod.id} />
                </>
            )}
        </Box>
    )
}
CCVPaymentMethodRadio.propTypes = {
    /** Currently selected payment method ID */
    paymentMethod: PropTypes.object,
    isSelected: PropTypes.bool
}

export const CCVMethodOptions = function ({paymentMethodId}) {
    switch (paymentMethodId) {
        case 'CCV_CREDIT_CARD': {
            return null
        }
        case 'CCV_CREDIT_CARD_INLINE': {
            return <CreditCardInlineOptions />
        }
        case 'CCV_IDEAL': {
            return <IdealOptions />
        }
        case 'CCV_GIROPAY': {
            return <GiropayOptions />
        }
        default: {
            return null
        }
    }
}

CCVMethodOptions.propTypes = {
    paymentMethodId: PropTypes.string
}
