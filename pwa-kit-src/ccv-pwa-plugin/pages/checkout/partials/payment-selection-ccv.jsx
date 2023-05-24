/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {useRef, useEffect} from 'react'
import {useIntl} from 'react-intl'
import PropTypes from 'prop-types'
import {
    Box,
    Radio,
    RadioGroup,
    Stack,
    FormErrorMessage,
    FormControl,
    Skeleton,
    Spacer
} from '@chakra-ui/react'
import {useForm, Controller} from 'react-hook-form'
import {useCheckout} from '../../../../app/pages/checkout/util/checkout-context'
import {CreditCardOptions} from './payment-method-options/options-cc'
import {GiropayOptions} from './payment-method-options/options-giropay'
import {IdealOptions} from './payment-method-options/options-ideal'
import {CreditCardInlineOptions} from './payment-method-options/options-cc-inline'

import {PaymentMethodIcons} from '../util/payment-components-ccv'
import {useCCVPayment} from '../util/ccv-context'

const PaymentSelection = ({form}) => {
    const {formatMessage} = useIntl()
    const {paymentMethods} = useCheckout()

    const paymentFormRef = useRef()
    form = form || useForm()

    const {onPaymentMethodChange} = useCCVPayment()
    const currentSelectedMethodId = form.watch('paymentMethodId')
    // focus form on error
    useEffect(() => {
        if (Object.keys(form.errors).length > 0) {
            paymentFormRef.current.scrollIntoView({behavior: 'smooth', block: 'start'})
        }
    }, [form.errors])

    return (
        <form>
            <FormControl
                id="paymentMethodId"
                isInvalid={form.errors.paymentMethodId}
                ref={paymentFormRef}
            >
                <FormErrorMessage marginTop={0} marginBottom={4}>
                    {form.errors.paymentMethodId?.message}
                </FormErrorMessage>
                <Stack spacing={5}>
                    <Box overflow="hidden">
                        <Controller
                            name="paymentMethodId"
                            defaultValue=""
                            control={form.control}
                            render={({onChange}) => (
                                <RadioGroup
                                    onChange={(e) => {
                                        onChange(e)
                                        onPaymentMethodChange(e)
                                    }}
                                >
                                    {/* dynamic payment methods */}
                                    <Stack gap={1}>
                                        {paymentMethods ? (
                                            paymentMethods.applicablePaymentMethods.map(
                                                (paymentMethod) => {
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
                                                }
                                            )
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

const CCVPaymentMethodRadio = function ({paymentMethod, isSelected}) {
    const {form} = useCCVPayment()

    return (
        <Box border="1px solid" borderColor="gray.100" rounded="base">
            {/* payment method heading row */}
            <Box bg="gray.50" py={3} px={[4, 4, 6]}>
                <Radio value={paymentMethod.id} alignItems="center">
                    <Stack direction="row" align="center">
                        <Box>{paymentMethod.name}</Box>
                        <Spacer />
                        <PaymentMethodIcons paymentMethodId={paymentMethod.id} iconHeight="28px" />
                    </Stack>
                </Radio>
            </Box>
            {isSelected && (
                <>
                    <CCVMethodOptions paymentMethodId={paymentMethod.id} />
                    <input
                        type="hidden"
                        name="ccvMethodId"
                        ref={form.register}
                        defaultValue={paymentMethod.c_ccvMethodId}
                    />
                </>
            )}
        </Box>
    )
}
CCVPaymentMethodRadio.propTypes = {
    /** Currently selected payment method ID */
    paymentMethod: PropTypes.object,
    isSelected: PropTypes.bool
}

const CCVMethodOptions = function ({paymentMethodId}) {
    const {customer} = useCheckout()

    switch (paymentMethodId) {
        case 'CCV_CREDIT_CARD': {
            return customer.isRegistered ? <CreditCardOptions /> : null
        }
        case 'CCV_CREDIT_CARD_INLINE': {
            return <CreditCardInlineOptions />
        }
        case 'CCV_IDEAL': {
            return <IdealOptions />
        }
        case 'CCV_GIROPAY': {
            return <GiropayOptions />
        }
        default: {
            return null
        }
    }
}

export default PaymentSelection
