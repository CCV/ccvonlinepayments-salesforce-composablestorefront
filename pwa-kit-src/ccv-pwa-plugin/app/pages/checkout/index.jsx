/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {useEffect, useState} from 'react'
import {Alert, AlertIcon, Box, Container, Grid, GridItem, Stack} from '@chakra-ui/react'
import {CheckoutProvider, useCheckout} from '@salesforce/retail-react-app/app/pages/checkout/util/checkout-context'
import ContactInfo from '@salesforce/retail-react-app/app/pages/checkout/partials/contact-info'
import ShippingAddress from '@salesforce/retail-react-app/app/pages/checkout/partials/shipping-address'
import {useCurrentCustomer} from '@salesforce/retail-react-app/app/hooks/use-current-customer'
import {useCurrentBasket} from '@salesforce/retail-react-app/app/hooks/use-current-basket'
import CheckoutSkeleton from '@salesforce/retail-react-app/app/pages/checkout/partials/checkout-skeleton'
import OrderSummary from '@salesforce/retail-react-app/app/components/order-summary'
import {PlaceOrderButton} from './util/payment-components-ccv'
import ShippingOptions from './partials/shipping-options'
import CCVPayment from './partials/payment-ccv'
import useCCVApi from './util/useCCVApi'

import {CCVPaymentProvider, useCCVPayment} from './util/ccv-context'

const Checkout = () => {
    const {globalError, step} = useCheckout()
    const [isLoading, setIsLoading] = useState(false)
    const ccv = useCCVApi()
    const {data: basket} = useCurrentBasket()
    const {paymentError, setPaymentError, applePayLoaded, setApplePayLoaded} = useCCVPayment()

    const isApplePay =
        basket.paymentInstruments &&
        basket.paymentInstruments[0].paymentMethodId === 'CCV_APPLE_PAY' &&
        applePayLoaded
    // Scroll to the top when we get a global error

    useEffect(() => {
        if (globalError || (step === 4 && !paymentError)) {
            window.scrollTo({top: 0})
        }
    }, [globalError, step])

    useEffect(() => {
        const script = document.createElement('script')

        script.src = 'https://applepay.cdn-apple.com/jsapi/v1/apple-pay-sdk.js'
        script.async = true

        document.body.appendChild(script)
        setApplePayLoaded(true)

        return () => {
            document.body.removeChild(script)
            setApplePayLoaded(false)
        }
    }, [])

    useEffect(() => {
        if (window.ApplePaySession) {
            var merchantIdentifier = 'example.com.store'
            var promise = window.ApplePaySession.canMakePaymentsWithActiveCard(merchantIdentifier)
            promise.then(function (canMakePayments) {
                if (canMakePayments) {
                    console.log(123)
                }
            })
        }
    }, [applePayLoaded])

    const onApplePayButtonClicked = async () => {
        ccv.onApplePayButtonClicked({setPaymentError, setIsLoading})
    }

    const submitOrder = async () => ccv.submitOrderCCV({setIsLoading, setPaymentError})

    return (
        <Box background="gray.50" flex="1">
            <Container
                data-testid="sf-checkout-container"
                maxWidth="container.xl"
                py={{base: 7, lg: 16}}
                px={{base: 0, lg: 8}}
            >
                <Grid templateColumns={{base: '1fr', lg: '66% 1fr'}} gap={{base: 10, xl: 20}}>
                    <GridItem>
                        <Stack spacing={4}>
                            {globalError && (
                                <Alert status="error" variant="left-accent">
                                    <AlertIcon />
                                    {globalError}
                                </Alert>
                            )}

                            <ContactInfo />
                            <ShippingAddress />
                            <ShippingOptions />
                            <CCVPayment />

                            {step === 4 && (
                                <Box pt={3} display={{base: 'none', lg: 'block'}}>
                                    <Container variant="form">
                                        <PlaceOrderButton
                                            submitOrderHandler={submitOrder}
                                            submitApplePayOrderHandler={onApplePayButtonClicked}
                                            isLoading={isLoading}
                                            isApplePay={isApplePay}
                                            basket={basket}
                                            data-testid="sf-checkout-place-order-btn"
                                        />
                                    </Container>
                                </Box>
                            )}
                        </Stack>
                    </GridItem>

                    <GridItem py={6} px={[4, 4, 4, 0]}>
                        <OrderSummary basket={basket} showTaxEstimationForm={false} showCartItems={true} />

                        {step === 4 && (
                            <Box display={{base: 'none', lg: 'block'}} pt={2}>
                                <PlaceOrderButton
                                    submitOrderHandler={submitOrder}
                                    submitApplePayOrderHandler={onApplePayButtonClicked}
                                    isLoading={isLoading}
                                    isApplePay={isApplePay}
                                    basket={basket}
                                />
                            </Box>
                        )}
                    </GridItem>
                </Grid>
            </Container>

            {step === 4 && (
                <Box
                    display={{lg: 'none'}}
                    position="sticky"
                    bottom="0"
                    px={4}
                    pt={6}
                    pb={11}
                    background="white"
                    borderTop="1px solid"
                    borderColor="gray.100"
                >
                    <Container variant="form">
                        <PlaceOrderButton
                            submitOrderHandler={submitOrder}
                            submitApplePayOrderHandler={onApplePayButtonClicked}
                            isLoading={isLoading}
                            isApplePay={isApplePay}
                            basket={basket}
                            dataTestid="sf-checkout-place-order-btn"
                        />
                    </Container>
                </Box>
            )}
        </Box>
    )
}

const CheckoutContainer = () => {
    const {data: basket} = useCurrentBasket()
    const {data: customer} = useCurrentCustomer()

    if (!customer || !customer.customerId || !basket || !basket.basketId) {
        return <CheckoutSkeleton />
    }

    return (
        <CheckoutProvider>
            <CCVPaymentProvider>
                <Checkout />
            </CCVPaymentProvider>
        </CheckoutProvider>
    )
}

export default CheckoutContainer
