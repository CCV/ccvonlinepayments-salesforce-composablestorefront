/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {useEffect} from 'react'
import PropTypes from 'prop-types'
import {FormattedMessage, useIntl} from 'react-intl'
import {Box, Checkbox, Heading, Stack, Text, Divider} from '@chakra-ui/react'
import {useCheckout} from '../util/checkout-context'
import usePaymentForms from '../util/usePaymentForms'
import {ToggleCard, ToggleCardEdit} from '../../../components/toggle-card'
import CCVPaymentSelection from './payment-selection-ccv'
import ShippingAddressSelection from './shipping-address-selection'
import AddressDisplay from '../../../components/address-display'
import {PromoCode, usePromoCode} from '../../../components/promo-code'

const Payment = ({setIsLoading}) => {
    const {formatMessage} = useIntl()

    const {
        step,
        checkoutSteps,
        setCheckoutStep,
        selectedShippingAddress,
        selectedBillingAddress,
        selectedPayment,
        getPaymentMethods
    } = useCheckout()

    const {paymentMethodForm, billingAddressForm, billingSameAsShipping, setBillingSameAsShipping} =
        usePaymentForms()

    const {removePromoCode, ...promoCodeProps} = usePromoCode()

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
                    <CCVPaymentSelection form={paymentMethodForm} setIsLoading={setIsLoading} />

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
                </Stack>
            </ToggleCardEdit>
        </ToggleCard>
    )
}

Payment.propTypes = {setIsLoading: PropTypes.func}

export default Payment
