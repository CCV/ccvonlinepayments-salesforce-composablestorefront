import React, {useState} from 'react'
import PropTypes from 'prop-types'
import {useLocation} from 'react-router-dom'
import {useCCVPaymentMethodsMap} from './payment-components-ccv'
import {useCurrentCustomer} from '@salesforce/retail-react-app/app/hooks/use-current-customer'
import {useCurrentBasket} from '@salesforce/retail-react-app/app/hooks/use-current-basket'
import {usePaymentMethodsForBasket} from '@salesforce/commerce-sdk-react'
import {useForm} from 'react-hook-form'
const CCVPaymentContext = React.createContext()

/** Can only be used inside checkout context */
export const CCVPaymentProvider = ({children}) => {
    const paymentMethodForm = useForm()
    const {data: basket} = useCurrentBasket()
    const {data: customer} = useCurrentCustomer()
    const location = useLocation()
    const {data: paymentMethodsResponse} = usePaymentMethodsForBasket({
        parameters: {
            basketId: basket?.basketId,
            shipmentId: 'me'
        }
    })

    const paymentMethods = paymentMethodsResponse?.applicablePaymentMethods

    const paymentMethodsMap = useCCVPaymentMethodsMap(paymentMethodsResponse)
    const [paymentError, setPaymentError] = useState(location.state?.paymentErrorMsg || '')

    const hasSavedCards = customer?.paymentInstruments?.length > 0
    const [isEditingPayment, setIsEditingPayment] = useState(!hasSavedCards)

    const [creditCardData, setCreditCardData] = useState({})

    const [applePayLoaded, setApplePayLoaded] = useState(false)

    const onPaymentIdChange = (value) => {
        if (value && isEditingPayment) {
            togglePaymentEdit()
        }
        paymentMethodForm.reset({
            paymentInstrumentId: value,
            paymentMethodId: paymentMethodForm.getValues('paymentMethodId')
        })
    }

    const getPaymentMethods = () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const {data: paymentMethodsResponse} = usePaymentMethodsForBasket({
            parameters: {
                basketId: basket?.basketId,
                shipmentId: 'me'
            }
        })

        return paymentMethodsResponse?.applicablePaymentMethods || []
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

    const ctx = {
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
        setPaymentError,
        applePayLoaded,
        setApplePayLoaded,
        getPaymentMethods,
        paymentMethods
    }

    return <CCVPaymentContext.Provider value={ctx}>{children}</CCVPaymentContext.Provider>
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
