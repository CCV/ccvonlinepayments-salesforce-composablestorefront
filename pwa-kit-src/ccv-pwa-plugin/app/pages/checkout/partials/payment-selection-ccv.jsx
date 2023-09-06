/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {useRef, useEffect} from 'react'
import {useIntl} from 'react-intl'
import PropTypes from 'prop-types'
import {Box, RadioGroup, Stack, FormErrorMessage, FormControl, Skeleton} from '@chakra-ui/react'
import {useForm, Controller} from 'react-hook-form'
import {useCheckout} from '@salesforce/retail-react-app/app/pages/checkout/util/checkout-context'
import {CCVPaymentMethodRadio} from './payment-method-radio-ccv'

import {useCCVPayment} from '../util/ccv-context'

const PaymentSelection = ({form}) => {
    const {formatMessage} = useIntl()

    const paymentFormRef = useRef()
    form = form || useForm()

    const {onPaymentMethodChange, getPaymentMethods} = useCCVPayment()
    const paymentMethods = getPaymentMethods()
    const currentSelectedMethodId = form.watch('paymentMethodId')
    // focus form on error
    useEffect(() => {
        if (form.errors && Object.keys(form.errors).length > 0) {
            paymentFormRef.current.scrollIntoView({behavior: 'smooth', block: 'start'})
        }
    }, [form.errors])

    return (
        <form>
            <FormControl
                id="paymentMethodId"
                isInvalid={form.formState.errors?.paymentMethodId}
                ref={paymentFormRef}
            >
                <FormErrorMessage marginTop={0} marginBottom={4}>
                    {form.formState.errors?.paymentMethodId?.message}
                </FormErrorMessage>
                <Stack spacing={5}>
                    <Box overflow="hidden">
                        <Controller
                            name="paymentMethodId"
                            defaultValue=""
                            control={form.control}
                            render={({field: {onChange}}) => (
                                <RadioGroup
                                    onChange={(e) => {
                                        onChange(e)
                                        onPaymentMethodChange(e)
                                    }}
                                >
                                    {/* dynamic payment methods */}
                                    <Stack gap={1}>
                                        {paymentMethods ? (
                                            paymentMethods.map((paymentMethod) => {
                                                    return (
                                                        <CCVPaymentMethodRadio
                                                            key={paymentMethod.id}
                                                            paymentMethod={paymentMethod}
                                                            isSelected={
                                                                currentSelectedMethodId ===
                                                                paymentMethod.id
                                                            }
                                                        />
                                                    )
                                                })
                                                .filter((x) => x)
                                        ) : (
                                            <Stack>
                                                <Skeleton height="56px" />
                                                <Skeleton height="56px" />
                                                <Skeleton height="56px" />
                                            </Stack>
                                        )}
                                    </Stack>
                                </RadioGroup>
                            )}
                            rules={{
                                required: formatMessage({
                                    defaultMessage: 'Please select a payment method.',
                                    id: 'payment_selection.message.select_payment_method'
                                })
                            }}
                        />
                    </Box>
                </Stack>
            </FormControl>
        </form>
    )
}

PaymentSelection.propTypes = {
    /** The form object returnd from `useForm` */
    form: PropTypes.object
}

export default PaymentSelection
