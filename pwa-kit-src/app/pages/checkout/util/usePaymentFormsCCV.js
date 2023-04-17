import {useEffect, useState} from 'react'
import {useForm} from 'react-hook-form'
import {useCheckout} from '../util/checkout-context'
import {getPaymentInstrumentCardType} from '../../../utils/cc-utils'

/**
 * A hook for managing and coordinating the billing address and payment method forms.
 * @returns {Object}
 */
const usePaymentFormsCCV = () => {
    const {
        selectedPayment,
        selectedBillingAddress,
        selectedShippingAddress,
        setBillingAddress,
        isBillingSameAsShipping,
        goToNextStep,
        customer,
        basket,
        isGuestCheckout
    } = useCheckout()

    // This local state value manages the 'checked' state of the billing address form's
    // checkbox for `Same as shipping address`. We initialize its value by checking if the
    // currently applied billing address matches the currently applied shipping address.
    const [billingSameAsShipping, setBillingSameAsShipping] = useState(isBillingSameAsShipping)

    const paymentMethodForm = useForm()

    const billingAddressForm = useForm({
        mode: 'onChange',
        shouldUnregister: false,
        defaultValues: {...selectedBillingAddress}
    })

    // This effect watches for changes to our basket's shipping/billing address. If they
    // are applied to the basket and they match, we update our local state value for the
    // `Same as shipping address` checkbox. This is necessary because when we initialized
    // `billingSameAsShipping` in `useState`, we may not have had the basket data yet, so
    // this ensures its properly set and in sync with our basket's state.
    useEffect(() => {
        if (!billingSameAsShipping && isBillingSameAsShipping) {
            setBillingSameAsShipping(true)
        }
    }, [isBillingSameAsShipping])

    const submitPaymentMethodForm = async (payment) => {
        // Make sure we only apply the payment if there isnt already one applied.
        // This works because a payment cannot be edited, only removed. In the UI,
        // we ensure that the any applied payment is removed before showing the
        // the payment form.
        if (!selectedPayment) {
            await setPaymentCCV(payment)
        }

        // Once the payment is applied to the basket, we submit the billing address.
        return billingAddressForm.handleSubmit(submitBillingAddressForm)()
    }

    const submitBillingAddressForm = async (address) => {
        if (!billingSameAsShipping) {
            await setBillingAddress(address)
        } else {
            await setBillingAddress(selectedShippingAddress)
        }

        // Once the billing address is applied to the basket, we can move to the final
        // step in the process, which lets the customer review all checkout info.
        goToNextStep()
    }

    // We need to submit the payment form and billing address form one at a time,
    // but from a single control/button. So we kick off the payment submit first
    // and let that function take over the next step.
    // ------
    // TODO: Figure out how to run the form validations simultaneuously before
    // submitting the forms, so one doesn't need to wait on the other to check for
    // client-side validation errors.
    const reviewOrder = () => {
        return paymentMethodForm.handleSubmit(submitPaymentMethodForm)()
    }

    /**
     * Applies the given payment instrument to the basket.
     * @see {@link https://salesforcecommercecloud.github.io/commerce-sdk-isomorphic/modules/shoppercustomers.html#orderpaymentinstrument}
     * @param {Object} payment
     */
    async function setPaymentCCV(payment) {
        const {paymentInstrumentId, paymentMethodId, ccvIssuerID, ccvMethodId} = payment

        if (paymentInstrumentId) {
            // Customer selected a saved card
            await basket.setPaymentInstrument({
                customerPaymentInstrumentId: paymentInstrumentId
            })
            return
        }

        const paymentInstrument = {
            paymentMethodId
        }

        if (ccvIssuerID) {
            paymentInstrument.c_ccv_issuer_id = ccvIssuerID
        }

        if (ccvMethodId) {
            paymentInstrument.c_ccv_method_id = ccvMethodId
        }

        // adding new credit card
        if (payment.number) {
            const [expirationMonth, expirationYear] = payment.expiry.split('/')

            paymentInstrument.paymentCard = {
                holder: payment.holder,
                number: payment.number.replace(/ /g, ''),
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

        await basket.setPaymentInstrument(paymentInstrument)

        // Save the payment instrument to the customer's account if they are registered
        if (!isGuestCheckout && !payment.id && payment.number) {
            customer.addSavedPaymentInstrument(paymentInstrument)
        }
    }

    return {
        paymentMethodForm,
        billingAddressForm,
        billingSameAsShipping,
        setBillingSameAsShipping,
        reviewOrder
    }
}

export default usePaymentFormsCCV
