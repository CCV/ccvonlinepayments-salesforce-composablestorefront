/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {useEffect, useState, useRef} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import {Box, Button, Checkbox, Container, Heading, Stack, Text, Divider} from '@chakra-ui/react'
import {useCheckout} from '@salesforce/retail-react-app/app/pages/checkout/util/checkout-context'
import {ToggleCard, ToggleCardEdit, ToggleCardSummary} from '@salesforce/retail-react-app/app/components/toggle-card'
import CCVPaymentSelection from './payment-selection-ccv'
import ShippingAddressSelection from '@salesforce/retail-react-app/app/pages/checkout/partials/shipping-address-selection'
import AddressDisplay from '@salesforce/retail-react-app/app/components/address-display'
import {PromoCode, usePromoCode} from '@salesforce/retail-react-app/app/components/promo-code'
import {useCurrentBasket} from '@salesforce/retail-react-app/app/hooks/use-current-basket'
import {useShopperBasketsMutation} from '@salesforce/commerce-sdk-react'
import usePaymentFormsCCV from '../util/usePaymentFormsCCV'
import {PaymentSummaryCCV} from '../util/payment-components-ccv'
import {useCCVPayment} from '../util/ccv-context'
import {CCVPaymentError} from './payment-error-ccv'

const CCVPayment = () => {
    const {formatMessage} = useIntl()
    const {data: basket} = useCurrentBasket()
    const {
        step,
        STEPS: checkoutSteps,
        goToStep,
    } = useCheckout()
    const {mutateAsync: removePaymentInstrumentFromBasket} = useShopperBasketsMutation(
        'removePaymentInstrumentFromBasket'
    )
    const selectedShippingAddress = basket.shipments && basket.shipments[0].shippingAddress
    const selectedBillingAddress = basket.billingAddress
    const selectedPayment = basket.paymentInstruments && basket.paymentInstruments[0]

    const {paymentError, setPaymentError} = useCCVPayment()

    const {
        paymentMethodForm,
        billingAddressForm,
        billingSameAsShipping,
        setBillingSameAsShipping,
        reviewOrder
    } = usePaymentFormsCCV()

    const {removePromoCode, ...promoCodeProps} = usePromoCode()

    const paymentErrorRef = useRef()

    // focus on payment error
    useEffect(() => {
        if (paymentError && paymentErrorRef.current) {
            paymentErrorRef.current.scrollIntoView({behavior: 'smooth', block: 'center'})
        }
    }, [paymentError, paymentErrorRef])

    const onPaymentError = async () => {
        if (paymentError && selectedPayment?.paymentCard) {
            // delete customer payment instrument if there was an error and the basket was reopened
            // because the PAN will be masked and unusable
            await removePaymentAndResetForm()
            goToStep(checkoutSteps.PAYMENT)
        }
    }

    useEffect(() => {
        onPaymentError()
    }, [paymentError])

    // clearing paymentErrorMsg from location.state
    useEffect(() => {
        const newState = {...window.history.state}
        delete newState.state?.paymentErrorMsg

        window.history.replaceState(newState, '')
    }, [])

    const [isRemovingPayment, setIsRemovingPayment] = useState(false)
    async function removePaymentAndResetForm() {
        setIsRemovingPayment(true)
        try {
            await removePaymentInstrumentFromBasket({
                parameters: {
                    basketId: basket.basketId,
                    paymentInstrumentId: basket.paymentInstruments[0].paymentInstrumentId
                }
            })
            paymentMethodForm.reset({paymentInstrumentId: '', paymentMethodId: ''})
        } catch (error) {
            console.log(error)
        }
        setIsRemovingPayment(false)
    }

    return (
        <>
            <ToggleCard
                id="step-3"
                title={formatMessage({
                    defaultMessage: 'Payment',
                    id: 'checkout_payment.title.payment'
                })}
                editing={step === checkoutSteps.PAYMENT}
                isLoading={
                    paymentMethodForm.formState.isSubmitting ||
                    billingAddressForm.formState.isSubmitting ||
                    isRemovingPayment
                }
                disabled={selectedPayment == null}
                onEdit={() => {
                    goToStep(checkoutSteps.PAYMENT)
                    setPaymentError(null)
                }}
            >
                <ToggleCardEdit>
                    <Box mt={-2} mb={4}>
                        <PromoCode {...promoCodeProps} itemProps={{border: 'none'}} />
                    </Box>

                    <Stack spacing={6}>
                        {!selectedPayment ? (
                            <CCVPaymentSelection form={paymentMethodForm} hideSubmitButton />
                        ) : (
                            <Stack spacing={3}>
                                <Heading as="h3" fontSize="md">
                                    <PaymentSummaryCCV selectedPayment={selectedPayment} />
                                </Heading>
                                <Stack direction="row" spacing={4}>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        colorScheme="red"
                                        onClick={removePaymentAndResetForm}
                                    >
                                        <FormattedMessage
                                            defaultMessage="Remove"
                                            id="checkout_payment.action.remove"
                                        />
                                    </Button>
                                </Stack>
                            </Stack>
                        )}

                        <Divider borderColor="gray.100" />

                        <Stack spacing={2}>
                            <Heading as="h3" fontSize="md">
                                <FormattedMessage
                                    defaultMessage="Billing Address"
                                    id="checkout_payment.heading.billing_address"
                                />
                            </Heading>

                            <Checkbox
                                name="billingSameAsShipping"
                                isChecked={billingSameAsShipping}
                                onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                            >
                                <Text fontSize="sm" color="gray.700">
                                    <FormattedMessage
                                        defaultMessage="Same as shipping address"
                                        id="checkout_payment.label.same_as_shipping"
                                    />
                                </Text>
                            </Checkbox>

                            {billingSameAsShipping && selectedShippingAddress && (
                                <Box pl={7}>
                                    <AddressDisplay address={selectedShippingAddress} />
                                </Box>
                            )}
                        </Stack>

                        {!billingSameAsShipping && (
                            <ShippingAddressSelection
                                form={billingAddressForm}
                                selectedAddress={selectedBillingAddress}
                                hideSubmitButton
                            />
                        )}

                        <Box pt={3}>
                            <Container variant="form">
                                <Button w="full" onClick={reviewOrder}>
                                    <FormattedMessage
                                        defaultMessage="Review Order"
                                        id="checkout_payment.button.review_order"
                                    />
                                </Button>
                            </Container>
                        </Box>
                    </Stack>
                </ToggleCardEdit>

                <ToggleCardSummary>
                    <Stack spacing={6}>
                        {selectedPayment && (
                            <Stack spacing={3}>
                                <Heading as="h3" fontSize="md">
                                    <PaymentSummaryCCV selectedPayment={selectedPayment} />
                                </Heading>
                            </Stack>
                        )}

                        <Divider borderColor="gray.100" />

                        {selectedBillingAddress && (
                            <Stack spacing={2}>
                                <Heading as="h3" fontSize="md">
                                    <FormattedMessage
                                        defaultMessage="Billing Address"
                                        id="checkout_payment.heading.billing_address"
                                    />
                                </Heading>
                                <AddressDisplay address={selectedBillingAddress} />
                            </Stack>
                        )}
                    </Stack>
                </ToggleCardSummary>
            </ToggleCard>

            <CCVPaymentError msg={paymentError} innerRef={paymentErrorRef} />
        </>
    )
}
export default CCVPayment
