import {useState, useCallback, useRef} from 'react'
import {useIntl} from 'react-intl'
import {set, useForm} from 'react-hook-form'
import {useShopperBasketsMutation} from '@salesforce/commerce-sdk-react'
import {useCurrentBasket} from '@salesforce/retail-react-app/app/hooks/use-current-basket'
import {getPaymentInstrumentCardType} from '@salesforce/retail-react-app/app/utils/cc-utils'
import {useCheckout} from '@salesforce/retail-react-app/app/pages/checkout/util/checkout-context'

import {useCCVPayment} from './ccv-context'
import useCCVApi from './useCCVApi'
import {useCommerceApi, useAccessToken} from '@salesforce/commerce-sdk-react'
import useNavigation from '@salesforce/retail-react-app/app/hooks/use-navigation'
import {useQueryClient} from '@tanstack/react-query'

/**
 * A hook for managing and coordinating the billing address and payment method forms.
 * @returns {Object}
 */
const usePaymentFormsCCV = () => {
    const {goToNextStep, step, STEPS, goToStep} = useCheckout()
    const {data: basket} = useCurrentBasket()
    const {locale, formatMessage} = useIntl()
    const ccv = useCCVApi()
    const selectedShippingAddress = basket?.shipments[0]?.shippingAddress
    const selectedBillingAddress = basket?.billingAddress
    const selectedPayment = basket?.paymentInstruments && basket.paymentInstruments[0]
    const {getTokenWhenReady} = useAccessToken()
    const api = useCommerceApi()
    const navigate = useNavigation()
    const {getConfig} = require('@salesforce/pwa-kit-runtime/utils/ssr-config')
    const { app: { CCV } } = getConfig()

    // Values can be changed under config/default.js
    const MAX_RETRIES = CCV.polling.maxRetries || 100 // set to maximum 5min of polling time (BMC QR code lifecycle)
    const TIME_BETWEEN_RETRIES = CCV.polling.timeBetweenRetries || 3000 // Polling to CCV every 3sec (BMC QR code)
    
    let retries = 0
    let interval = useRef(null)
    const queryClient = useQueryClient()

    const [QRcode, setQRcode] = useState()

    const {mutateAsync: updatePaymentInstrumentInBasket} = useShopperBasketsMutation(
        'updatePaymentInstrumentInBasket'
    )

    const {mutateAsync: addPaymentInstrumentToBasket} = useShopperBasketsMutation(
        'addPaymentInstrumentToBasket'
    )

    const {mutateAsync: updateBillingAddressForBasket} = useShopperBasketsMutation(
        'updateBillingAddressForBasket'
    )

    const {form: paymentMethodForm, creditCardData, setCreditCardData, paymentMethods, setPaymentError, URLintent, setURLintent} = useCCVPayment()
    const [isLoading, setIsLoading] = useState(false)
    const [billingSameAsShipping, setBillingSameAsShipping] = useState(true)

    const billingAddressForm = useForm({
        mode: 'onChange',
        shouldUnregister: false,
        defaultValues: {...selectedBillingAddress}
    })

    const getOrder = async (orderNo) => {
        const token = await getTokenWhenReady()
        const order = await api.shopperOrders.getOrder({
            parameters: {
                orderNo
            },
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        return order
    }

    const checkOrderStatus = useCallback(async (orderNo, order) => {
        if (!order) {
            order = await getOrder(orderNo)
        }
        if ((retries >= MAX_RETRIES && order.status === 'created')) {
            // Customer is inactive and not responding on the QR code, because the lifetime of this QR is exceeded.
            // we automatically reset and redirect the customer to a new session
            clearInterval(interval)
            navigate('/')
            return
        }
        if ((order.status === 'created' || order.status === 'new') && order.paymentStatus === 'paid') {
            clearInterval(interval)
            navigate(`/checkout/confirmation/${orderNo}`)
            return
        }
        if (order.status === 'failed') {
            clearInterval(interval)
            const message = formatMessage({
                id: 'checkout.message.generic_error',
                defaultMessage: 'An unexpected error occurred during checkout.'
            })
            // Throw error when payment is failed, even when a customer is returned from landingpage to the webshop
            // By throwing this error, a paymentInstrument removal of the current basket will apply
            setPaymentError(message)
            return
        }
    })

    const startOrderPolling = async (orderNo) => {
        interval = setInterval(() => {
            retries++
            checkOrderStatus(orderNo)
        }, TIME_BETWEEN_RETRIES)
    }



    const submitPaymentMethodForm = async (payment) => {
        // Make sure we only apply the payment if there isnt already one applied.
        // This works because a payment cannot be edited, only removed. In the UI,
        // we ensure that the any applied payment is removed before showing the
        // the payment form.
        if (!selectedPayment) {
            await setPaymentCCV(payment)
        }

        if ((payment.paymentMethodId === 'CCV_BANCONTACT_QR') && !QRcode) {
            const orderResponsePromise = ccv.initiateOrderCCV({setIsLoading, setPaymentError})
    
            orderResponsePromise.then((orderResponse) => {
                if (!orderResponse) {
                    console.log('Order initiation failed! Aborting payment session.')
                    return null
                }
                const qrCodeData = orderResponse.c_ccvQrCode
                const urlIntentData = orderResponse.c_ccvUrlIntent
                const data = {QRcode: qrCodeData, URLintent: urlIntentData, orderNo: orderResponse.orderNo}

                setQRcode(data.QRcode)
                startOrderPolling(data.orderNo)
                setURLintent(data.URLintent)
            })
        }

        // Once the payment is applied to the basket, we submit the billing address.
        return billingAddressForm.handleSubmit(submitBillingAddressForm)()
    }

    const submitBillingAddressForm = async (address) => {
        const addressSource = billingSameAsShipping ? selectedShippingAddress : address

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {id, preferred, creationDate, lastModified, addressId, addressName, ...addressToSet} =
            addressSource

        await updateBillingAddressForBasket({
            body: addressToSet,
            parameters: {basketId: basket.basketId, shipmentId: 'me'}
        })

        // Once the billing address is applied to the basket, we can move to the final
        // step in the process, which lets the customer review all checkout info.
        goToNextStep()
    }

    // We need to submit the payment form and billing address form one at a time,
    // but from a single control/button. So we kick off the payment submit first
    // and let that function take over the next step.
    // ------
    // TODO: Figure out how to run the form validations simultaneously before
    // submitting the forms, so one doesn't need to wait on the other to check for
    // client-side validation errors.
    const reviewOrder = async () => {
        return paymentMethodForm.handleSubmit(submitPaymentMethodForm)()
    }

    /**
     * Applies the given payment instrument to the basket.
     * @see {@link https://salesforcecommercecloud.github.io/commerce-sdk-isomorphic/modules/shoppercustomers.html#orderpaymentinstrument}
     * @param {Object} payment
     */
    async function setPaymentCCV(payment) {
        const {paymentMethodId, ccvIssuerID} = payment
        const ccvMethodId = paymentMethods.find(
            (paymentMethod) => paymentMethod.id === paymentMethodId
        )?.c_ccvMethodId

        const paymentInstrument = {
            paymentMethodId
        }

        if (ccvIssuerID) {
            paymentInstrument.c_ccv_issuer_id = ccvIssuerID
        }

        if (ccvMethodId) {
            paymentInstrument.c_ccv_method_id = ccvMethodId
        }

        if (payment.saveCard) {
            paymentInstrument.c_ccv_save_card = true
        }

        // adding new credit card to basket for inline card method
        if (payment.number) {
            const splitName = payment.holder.split(' ')

            // data to send to CCV cardDataURL
            setCreditCardData({
                pan: payment.number.replace(/ /g, ''),
                expiryDate: payment.expiry,
                cardholderFirstName: splitName[0],
                cardholderLastName: splitName[splitName.length - 1]
            })

            // saving masked information to basket
            const [expirationMonth, expirationYear] = payment.expiry.split('/')
            paymentInstrument.paymentCard = {
                holder: payment.holder,
                maskedNumber: payment.number.replace(/ /g, '').replace(/\d(?=\d{4})/g, '#'),
                cardType: getPaymentInstrumentCardType(payment.cardType),
                expirationMonth: parseInt(expirationMonth),
                expirationYear: parseInt(expirationYear),

                // TODO: These fields are required for saving the card to the customer's
                // account. Im not sure what they are for or how to get them, so for now
                // we're just passing some values to make it work. Need to investigate.
                issueNumber: '',
                validFromMonth: 1,
                validFromYear: 2020
            }
        }

        if (!basket.paymentInstruments) {
            await addPaymentInstrumentToBasket({
                parameters: {basketId: basket?.basketId},
                body: paymentInstrument
            })
        } else {
            await updatePaymentInstrumentInBasket({
                parameters: {
                    basketId: basket?.basketId,
                    paymentInstrumentId: basket.paymentInstruments[0].paymentInstrumentId
                },
                body: paymentInstrument
            })
        }
    }

    return {
        paymentMethodForm,
        billingAddressForm,
        billingSameAsShipping,
        setBillingSameAsShipping,
        reviewOrder,
        QRcode,
        setQRcode
    }
}

export default usePaymentFormsCCV
