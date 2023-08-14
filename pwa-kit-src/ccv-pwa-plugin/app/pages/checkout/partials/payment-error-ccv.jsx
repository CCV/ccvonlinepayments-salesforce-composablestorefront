import React from 'react'
import PropTypes from 'prop-types'
import {useIntl} from 'react-intl'
import {Alert, AlertIcon} from '@chakra-ui/react'

export const CCVPaymentError = ({msg, innerRef}) => {
    if (!msg) return null

    const {formatMessage} = useIntl()
    let formattedMsg

    if (msg === 'card_refused') {
        formattedMsg = formatMessage({
            defaultMessage: 'The payment could not be authorized - card refused.',
            id: `checkout_payment.ccv_payment_error_card_refused`
        })
    } else if (msg === 'insufficient_funds') {
        formattedMsg = formatMessage({
            defaultMessage: 'The payment could not be authorized - insufficient funds.',
            id: `checkout_payment.ccv_payment_error_insufficient_funds`
        })
    } else if (msg === 'cancelled') {
        formattedMsg = formatMessage({
            defaultMessage: 'The payment could not be authorized - payment cancelled.',
            id: `checkout_payment.ccv_payment_error_cancelled`
        })
    } else if (msg === 'basket_stale_price') {
        formattedMsg = formatMessage({
            defaultMessage: 'Your basket has been updated. Please, try again.',
            id: `checkout_payment.ccv_payment_error_cancelled`
        })
    } else {
        formattedMsg = formatMessage({
            defaultMessage: 'The payment could not be authorized successfully.',
            id: `checkout_payment.ccv_payment_error_default`
        })
    }

    return (
        <Alert ref={innerRef} status="error" variant="left-accent">
            <AlertIcon />
            {formattedMsg}
        </Alert>
    )
}

CCVPaymentError.propTypes = {
    /** Error msg text */
    msg: PropTypes.string,
    /** Ref */
    innerRef: PropTypes.object
}
