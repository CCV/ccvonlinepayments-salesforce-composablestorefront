import React, {useState} from 'react'
import PropTypes from 'prop-types'
import {useCCVPaymentMethodsMap} from './ccv-utils'
import {useCheckout} from '../checkout-context'
const CCVPaymentContext = React.createContext()
import {useForm} from 'react-hook-form'

/** Can only be used inside checkout context */
export const CCVPaymentProvider = ({form, children}) => {
    const {customer} = useCheckout()
    form = form || useForm()

    const hasSavedCards = customer?.paymentInstruments?.length > 0
    const paymentMethodsMap = useCCVPaymentMethodsMap()

    const [isEditingPayment, setIsEditingPayment] = useState(!hasSavedCards)

    const onPaymentIdChange = (value) => {
        console.log(form.getValues())
        if (value && isEditingPayment) {
            togglePaymentEdit()
        }
        form.reset({paymentInstrumentId: value})
    }

    const togglePaymentEdit = () => {
        form.reset({paymentInstrumentId: ''})
        setIsEditingPayment(!isEditingPayment)
        form.trigger()
    }

    const onPaymentMethodChange = () => {
        if (isEditingPayment) {
            togglePaymentEdit()
        }
    }

    return (
        <CCVPaymentContext.Provider
            value={{
                form,
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
