import React, {useState} from 'react'
import PropTypes from 'prop-types'
import {useCCVPaymentMethodsMap} from './ccv-utils'
import {useCheckout} from '../checkout-context'
const CCVPaymentContext = React.createContext()
import usePaymentFormsCCV from '../usePaymentFormsCCV'

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

    const hasSavedCards = customer?.paymentInstruments?.length > 0
    const paymentMethodsMap = useCCVPaymentMethodsMap()

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
                onPaymentMethodChange
            }}
        >
            {children}
        </CCVPaymentContext.Provider>
    )
}

CCVPaymentProvider.propTypes = {children: PropTypes.any, form: PropTypes.object}

export const useCCVPayment = () => {
    return React.useContext(CCVPaymentContext)
}
