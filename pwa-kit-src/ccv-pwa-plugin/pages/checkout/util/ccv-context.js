import React, {useState} from 'react'
import PropTypes from 'prop-types'
import {useLocation} from 'react-router-dom'
import {useCCVPaymentMethodsMap} from './payment-components-ccv'
import {useCheckout} from '../../../../app/pages/checkout/util/checkout-context'
import {useForm} from 'react-hook-form'
const CCVPaymentContext = React.createContext()

/** Can only be used inside checkout context */
export const CCVPaymentProvider = ({children}) => {
    const paymentMethodForm = useForm()
    const {customer} = useCheckout()
    const location = useLocation()

    const paymentMethodsMap = useCCVPaymentMethodsMap()
    const [paymentError, setPaymentError] = useState(location.state?.paymentErrorMsg || '')

    const hasSavedCards = customer?.paymentInstruments?.length > 0
    const [isEditingPayment, setIsEditingPayment] = useState(!hasSavedCards)

    const [creditCardData, setCreditCardData] = useState({})

    const onPaymentIdChange = (value) => {
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
                form: paymentMethodForm,
                hasSavedCards,
                isEditingPayment,
                setIsEditingPayment,
                paymentMethodsMap,
                onPaymentIdChange,
                togglePaymentEdit,
                onPaymentMethodChange,
                creditCardData,
                setCreditCardData,
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
