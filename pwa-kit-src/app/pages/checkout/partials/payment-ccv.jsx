/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {useEffect, useMemo} from 'react'
import PropTypes from 'prop-types'
import {FormattedMessage, useIntl} from 'react-intl'
import {Box, Button, Checkbox, Container, Heading, Stack, Text, Divider} from '@chakra-ui/react'
import {useCheckout} from '../util/checkout-context'
import usePaymentForms from '../util/usePaymentForms'
import {ToggleCard, ToggleCardEdit, ToggleCardSummary} from '../../../components/toggle-card'
import CCVPaymentSelection from './payment-selection-ccv'
import ShippingAddressSelection from './shipping-address-selection'
import AddressDisplay from '../../../components/address-display'
import {PromoCode, usePromoCode} from '../../../components/promo-code'

const Payment = () => {
    const {formatMessage} = useIntl()

    const {
        step,
        checkoutSteps,
        setCheckoutStep,
        selectedShippingAddress,
        selectedBillingAddress,
        selectedPayment,
        getPaymentMethods,
        paymentMethods,
        removePayment
    } = useCheckout()

    const {
        paymentMethodForm,
        billingAddressForm,
        billingSameAsShipping,
        setBillingSameAsShipping,
        reviewOrder
    } = usePaymentForms()

    const {removePromoCode, ...promoCodeProps} = usePromoCode()

    function removePaymentAndResetForm() {
        removePayment()
        paymentMethodForm.reset({paymentInstrumentId: ''})
    }

    const paymentMethodsMap = useMemo(() => {
        console.log(paymentMethods)
        if (!paymentMethods) return {}
        return paymentMethods.applicablePaymentMethods.reduce((result, current) => {
            result[current.id] = current
            return result
        }, {})
    }, [paymentMethods])

    const selectedPaymentName =
        (selectedPayment && paymentMethodsMap[selectedPayment.paymentMethodId]?.name) || ''

    useEffect(() => {
        getPaymentMethods()
    }, [])

    return (
        <ToggleCard
            id="step-3"
            title={formatMessage({defaultMessage: 'Payment', id: 'checkout_payment.title.payment'})}
            editing={step === checkoutSteps.Payment}
            isLoading={
                paymentMethodForm.formState.isSubmitting ||
                billingAddressForm.formState.isSubmitting
            }
            disabled={selectedPayment == null}
            onEdit={() => setCheckoutStep(checkoutSteps.Payment)}
        >
            <ToggleCardEdit>
                <Box mt={-2} mb={4}>
                    <PromoCode {...promoCodeProps} itemProps={{border: 'none'}} />
                </Box>

                <Stack spacing={6}>
                    {!selectedPayment ? (
                        <CCVPaymentSelection form={paymentMethodForm} />
                    ) : (
                        <Stack spacing={3}>
                            <Heading as="h3" fontSize="md">
                                {selectedPaymentName}
                            </Heading>
                            <Stack direction="row" spacing={4}>
                                <PaymentSummaryCCV
                                    payment={selectedPayment}
                                    paymentMethodsMap={paymentMethodsMap}
                                />
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
                                {selectedPaymentName}
                            </Heading>
                            <PaymentSummaryCCV
                                payment={selectedPayment}
                                paymentMethodsMap={paymentMethodsMap}
                            />
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
    )
}

const PaymentSummaryCCV = ({payment, paymentMethodsMap}) => {
    const paymentMethodObj = paymentMethodsMap[payment.paymentMethodId]

    return (
        <Stack direction="row" alignItems="center" spacing={3}>
            {paymentMethodObj && paymentMethodObj.name}
        </Stack>
    )
}
PaymentSummaryCCV.propTypes = {payment: PropTypes.object, paymentMethodsMap: PropTypes.object}

export default Payment
