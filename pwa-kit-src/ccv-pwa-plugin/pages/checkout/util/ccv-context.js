import React, {useState} from 'react'
import PropTypes from 'prop-types'
import {useLocation} from 'react-router-dom'
import {useCCVPaymentMethodsMap} from './ccv-utils'
import {useCheckout} from '../../../../app/pages/checkout/util/checkout-context'
import usePaymentFormsCCV from './usePaymentFormsCCV'

const CCVPaymentContext = React.createContext()

/** Can only be used inside checkout context */
export const CCVPaymentProvider = ({children}) => {
    const {
        paymentMethodForm,
        billingAddressForm,
        billingSameAsShipping,
        setBillingSameAsShipping,
        reviewOrder
    } = usePaymentFormsCCV()

    const {customer} = useCheckout()
    const location = useLocation()

    const paymentMethodsMap = useCCVPaymentMethodsMap()
    const [paymentError, setPaymentError] = useState(location.state?.paymentErrorMsg || '')

    const hasSavedCards = customer?.paymentInstruments?.length > 0
    const [isEditingPayment, setIsEditingPayment] = useState(!hasSavedCards)

    const onPaymentIdChange = (value) => {
        console.log(paymentMethodForm.getValues())
        if (value && isEditingPayment) {
            togglePaymentEdit()
        }
        paymentMethodForm.reset({
            paymentInstrumentId: value,
            paymentMethodId: paymentMethodForm.getValues('paymentMethodId')
        })
    }

    const togglePaymentEdit = () => {
        paymentMethodForm.reset({
            paymentInstrumentId: '',
            paymentMethodId: paymentMethodForm.getValues('paymentMethodId')
        })
        paymentMethodForm.setValue('paymentInstrumentId', '')

        setIsEditingPayment(!isEditingPayment)
        paymentMethodForm.trigger()
    }

    const onPaymentMethodChange = () => {
        if (isEditingPayment) {
            togglePaymentEdit()
        }
        setPaymentError('')
    }

    return (
        <CCVPaymentContext.Provider
            value={{
                paymentForms: {
                    paymentMethodForm,
                    billingAddressForm,
                    billingSameAsShipping,
                    setBillingSameAsShipping,
                    reviewOrder
                },
                form: paymentMethodForm,
                hasSavedCards,
                isEditingPayment,
                setIsEditingPayment,
                paymentMethodsMap,
                onPaymentIdChange,
                togglePaymentEdit,
                onPaymentMethodChange,
                paymentError,
                setPaymentError
            }}
        >
            {children}
        </CCVPaymentContext.Provider>
    )
}

CCVPaymentProvider.propTypes = {
    children: PropTypes.any,
    paymentError: PropTypes.string,
    setPaymentError: PropTypes.func
}

export const useCCVPayment = () => {
    return React.useContext(CCVPaymentContext)
}
export const asd = 212
