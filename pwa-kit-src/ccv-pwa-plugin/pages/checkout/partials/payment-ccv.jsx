/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {useEffect, useState, useRef} from 'react'
import PropTypes from 'prop-types'
import {FormattedMessage, useIntl} from 'react-intl'
import {
    Alert,
    AlertIcon,
    Box,
    Button,
    Checkbox,
    Container,
    Heading,
    Stack,
    Text,
    Divider
} from '@chakra-ui/react'
import {useCheckout} from '../../../../app/pages/checkout/util/checkout-context'
import {ToggleCard, ToggleCardEdit, ToggleCardSummary} from '../../../../app/components/toggle-card'
import CCVPaymentSelection from './payment-selection-ccv'
import ShippingAddressSelection from '../../../../app/pages/checkout/partials/shipping-address-selection'
import AddressDisplay from '../../../../app/components/address-display'
import {PromoCode, usePromoCode} from '../../../../app/components/promo-code'
import {PaymentSummaryCCV} from '../util/ccv-utils'
import {useCCVPayment} from '../util/ccv-context'

const CCVPayment = () => {
    const {formatMessage} = useIntl()

    const {
        step,
        checkoutSteps,
        setCheckoutStep,
        selectedShippingAddress,
        selectedBillingAddress,
        selectedPayment,
        getPaymentMethods,
        removePayment
    } = useCheckout()

    const {
        paymentForms: {
            paymentMethodForm,
            billingAddressForm,
            billingSameAsShipping,
            setBillingSameAsShipping,
            reviewOrder
        },
        paymentError,
        setPaymentError
    } = useCCVPayment()

    const {removePromoCode, ...promoCodeProps} = usePromoCode()

    const paymentErrorRef = useRef()

    // focus on payment error
    useEffect(() => {
        if (paymentError && paymentErrorRef.current) {
            paymentErrorRef.current.scrollIntoView({behavior: 'smooth', block: 'center'})
        }
    }, [paymentError, paymentErrorRef])

    useEffect(async () => {
        if (paymentError && selectedPayment?.paymentCard) {
            // delete customer payment instrument if there was an error and the basket was reopened
            // because the PAN will be masked and unusable
            await removePaymentAndResetForm()
            setCheckoutStep(checkoutSteps.Payment)
        }
    }, [paymentError])

    // clearing any payment errors from location.state
    useEffect(() => {
        window.history.replaceState({}, '')
    }, [])

    const [isRemovingPayment, setIsRemovingPayment] = useState(false)
    async function removePaymentAndResetForm() {
        setIsRemovingPayment(true)
        try {
            await removePayment()
            paymentMethodForm.reset({paymentInstrumentId: '', paymentMethodId: ''})
        } catch (error) {
            console.log(error)
        }
        setIsRemovingPayment(false)
    }

    useEffect(() => {
        getPaymentMethods()
    }, [])

    return (
        <>
            <CCVPaymentError msg={paymentError} innerRef={paymentErrorRef} />

            <ToggleCard
                id="step-3"
                title={formatMessage({
                    defaultMessage: 'Payment',
                    id: 'checkout_payment.title.payment'
                })}
                editing={step === checkoutSteps.Payment}
                isLoading={
                    paymentMethodForm.formState.isSubmitting ||
                    billingAddressForm.formState.isSubmitting ||
                    isRemovingPayment
                }
                disabled={selectedPayment == null}
                onEdit={() => {
                    setCheckoutStep(checkoutSteps.Payment)
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
        </>
    )
}

const CCVPaymentError = ({msg, innerRef}) => {
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

export default CCVPayment
