/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {useEffect, useRef, useState} from 'react'
import {useIntl} from 'react-intl'
import PropTypes from 'prop-types'
import {
    FormLabel,
    Radio,
    RadioGroup,
    Stack,
    Select,
    FormErrorMessage,
    FormControl,
    Box
} from '@chakra-ui/react'
import {useForm, Controller} from 'react-hook-form'
import {useCheckout} from '../util/checkout-context'
import {useCCVPaymentMethodsMap, PaymentMethodIcons} from '../../../utils/ccv-utils'

const CCVPaymentSelection = ({form}) => {
    const {formatMessage} = useIntl()
    const {paymentMethods} = useCheckout()
    const paymentFormRef = useRef()
    const paymentMethodsMap = useCCVPaymentMethodsMap()

    form = form || useForm()
    const onPaymentIdChange = () => {
        // form.clearErrors('paymentInstrumentId')
        // form.setValue('paymentInstrumentId', value)
        form.setValue('ccvOption', '')
        setCurrentSelectedMethodId(form.getValues('paymentInstrumentId'))
    }
    const test = (e) => {
        e.preventDefault()
        console.log(form.getValues())
        console.log(form)
    }
    console.log(form.getValues())
    useEffect(() => {
        form.reset({paymentInstrumentId: ''})
        form.trigger()
    }, [])

    const [currentSelectedMethodId, setCurrentSelectedMethodId] = useState(
        form.getValues('paymentInstrumentId')
    )

    useEffect(() => {
        if (form.errors.paymentInstrumentId?.ref) {
            paymentFormRef.current.scrollIntoView({behavior: 'smooth', block: 'start'})
        }
    }, [form.errors])

    return (
        <form id="payment-form" ref={paymentFormRef} style={{scrollMarginTop: '5rem'}}>
            <FormControl id="paymentInstrumentId" isInvalid={form.errors.paymentInstrumentId}>
                <FormLabel>Select a payment method</FormLabel>
                <FormErrorMessage marginTop={0} marginBottom={4}>
                    {form.errors.paymentInstrumentId?.message}
                </FormErrorMessage>
                <Controller
                    name="paymentInstrumentId"
                    defaultValue=""
                    control={form.control}
                    render={({onChange}) => (
                        <RadioGroup
                            onChange={(e) => {
                                console.log(e)
                                onChange(e)
                                onPaymentIdChange()
                            }}
                        >
                            <Stack>
                                {paymentMethods &&
                                    paymentMethods.applicablePaymentMethods.map((paymentMethod) => (
                                        <>
                                            <Stack
                                                key={paymentMethod.id}
                                                direction="row"
                                                align="center"
                                            >
                                                <Radio value={paymentMethod.id} marginTop="30px">
                                                    <Stack direction="row">
                                                        <Box>{paymentMethod.name}</Box>
                                                        <PaymentMethodIcons
                                                            ccvMethodId={
                                                                paymentMethod.c_ccvMethodId
                                                            }
                                                            iconHeight="30px"
                                                        />
                                                    </Stack>
                                                </Radio>
                                            </Stack>
                                            {currentSelectedMethodId === paymentMethod.id && (
                                                <CCVMethodOptions
                                                    marginTop="-10px"
                                                    paymentMethodId={currentSelectedMethodId}
                                                    form={form}
                                                    paymentMethodsMap={paymentMethodsMap}
                                                />
                                            )}
                                        </>
                                    ))}
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
            </FormControl>
            <button onClick={test}>test</button>
        </form>
    )
}

const CCVMethodOptions = function ({paymentMethodId, form, paymentMethodsMap}) {
    const {formatMessage} = useIntl()
    const selectedMethodData = paymentMethodsMap[paymentMethodId]

    switch (paymentMethodId) {
        case 'CCV_IDEAL': {
            const options = JSON.parse(selectedMethodData.c_ccvOptions)

            const countryGroups = {}
            options.forEach((option) => {
                if (!countryGroups[option.group]) {
                    countryGroups[option.group] = [option]
                } else countryGroups[option.group].push(option)
            })

            return (
                <FormControl id="ccvOption" isInvalid={form.errors.ccvOption}>
                    <FormErrorMessage marginTop={0} marginBottom={4}>
                        {form.errors.ccvOption?.message}
                    </FormErrorMessage>
                    <Controller
                        as={Select}
                        name="ccvOption"
                        defaultValue=""
                        control={form.control}
                        rules={{
                            required: formatMessage({
                                defaultMessage: 'Please select an option.',
                                id: 'payment_selection.message.select_payment_method_option'
                            })
                        }}
                    >
                        <option value="">Choose your bank...</option>
                        {Object.keys(countryGroups).map((countryGroup) => {
                            return (
                                <optgroup label={countryGroup} key={countryGroup}>
                                    {countryGroups[countryGroup].map((issuer) => {
                                        return (
                                            <option value={issuer.issuerid} key={issuer.issuerid}>
                                                {issuer.issuerdescription}
                                            </option>
                                        )
                                    })}
                                </optgroup>
                            )
                        })}
                    </Controller>
                </FormControl>
            )
        }
        default:
            return <input type="hidden" {...form.register('ccvOption')} defaultValue="" />
    }
}

CCVMethodOptions.propTypes = {
    /** Payment method for which options should be rendered */
    paymentMethodId: PropTypes.string,
    /** The form object returnd from `useForm` */
    form: PropTypes.object,
    /** Convenience object */
    paymentMethodsMap: PropTypes.shape({
        c_ccv_options: PropTypes.string
    })
}

CCVPaymentSelection.propTypes = {
    /** The form object returnd from `useForm` */
    form: PropTypes.object
}

export default CCVPaymentSelection
