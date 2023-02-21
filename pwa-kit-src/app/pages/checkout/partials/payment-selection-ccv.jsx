/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {useEffect, useRef} from 'react'
import {useIntl} from 'react-intl'
import PropTypes from 'prop-types'
import {FormLabel, Radio, RadioGroup, Stack, FormErrorMessage, FormControl} from '@chakra-ui/react'
import {useForm, Controller} from 'react-hook-form'
import {useCheckout} from '../util/checkout-context'
// import {AmexIcon, DiscoverIcon, MastercardIcon, VisaIcon, InfoIcon} from '../../../components/icons'
import usePaymentForms from '../util/usePaymentForms'
import useCCV from '../../../commerce-api/hooks/useCCV'

const CCVPaymentSelection = ({form, setIsLoading}) => {
    const {formatMessage} = useIntl()
    const {paymentMethods, setGlobalError} = useCheckout()
    const {submitPaymentMethodForm} = usePaymentForms()
    const ccv = useCCV()
    const paymentFormRef = useRef()

    form = form || useForm()
    const submitForm = async (payment) => {
        setIsLoading(true)
        try {
            console.log(payment)

            await submitPaymentMethodForm(payment)
            // create redirect session via ccv api
            const createRedirectSessionResponse = await ccv.createRedirectSession({
                paymentType: payment.ccvMethodId,
                option: ''
            })
            console.log(createRedirectSessionResponse)
            // redirect to hosted payment page
            window.location.href = createRedirectSessionResponse.payUrl
        } catch (error) {
            setIsLoading(false)
            console.log(error)
            const message = formatMessage({
                id: 'checkout.message.generic_error',
                defaultMessage: 'An unexpected error occurred during checkout.'
            })
            setGlobalError(message)
        }
    }

    const onPaymentIdChange = (value) => {
        form.clearErrors('paymentInstrumentId')

        form.setValue('paymentInstrumentId', value)
        const ccvId = paymentMethods.applicablePaymentMethods.find(
            (method) => method.id === value
        ).c_ccvMethodId

        // method id used in service call to ccv
        form.setValue('ccvMethodId', ccvId)
    }

    useEffect(() => {
        form.reset({paymentInstrumentId: ''})
        form.trigger()
    }, [])

    useEffect(() => {
        if (form.errors.paymentInstrumentId?.ref) {
            paymentFormRef.current.scrollIntoView({behavior: 'smooth', block: 'start'})
        }
    }, [form.errors])

    return (
        <form
            id="payment-form"
            ref={paymentFormRef}
            onSubmit={form.handleSubmit(submitForm)}
            style={{scrollMarginTop: '5rem'}}
        >
            {/* {JSON.stringify(paymentMethods)} */}
            <FormControl id="paymentInstrumentId" isInvalid={form.errors.paymentInstrumentId}>
                <FormLabel>Select a payment method</FormLabel>
                {form.errors.paymentInstrumentId && (
                    <FormErrorMessage marginTop={0} marginBottom={4}>
                        {form.errors.paymentInstrumentId.message}
                    </FormErrorMessage>
                )}
                <Controller
                    name="paymentInstrumentId"
                    defaultValue=""
                    control={form.control}
                    render={({field}) => (
                        <RadioGroup {...field} onChange={onPaymentIdChange}>
                            <Stack direction="column">
                                {paymentMethods &&
                                    paymentMethods.applicablePaymentMethods.map((paymentMethod) => {
                                        return (
                                            <Radio value={paymentMethod.id} key={paymentMethod.id}>
                                                {paymentMethod.name}
                                            </Radio>
                                        )
                                    })}
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
            <input type="hidden" {...form.register('ccvMethodId')} defaultValue="" />
        </form>
    )
}

CCVPaymentSelection.propTypes = {
    /** The form object returnd from `useForm` */
    form: PropTypes.object,

    /** setter for isLoading */
    setIsLoading: PropTypes.func
}

export default CCVPaymentSelection
