/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {useState} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import PropTypes from 'prop-types'
import {
    Box,
    Button,
    Container,
    Heading,
    Radio,
    RadioGroup,
    Select,
    Stack,
    FormErrorMessage,
    FormControl
} from '@chakra-ui/react'
import {useForm, Controller} from 'react-hook-form'
import {useCheckout} from '../util/checkout-context'
import CreditCardFields from '../../../components/forms/credit-card-fields'
import CCRadioGroup from './cc-radio-group'
import {useCCVPaymentMethodsMap, PaymentMethodIcons} from '../../../utils/ccv-utils'
// import Field from '../../../components/field'

const PaymentSelection = ({form, hideSubmitButton}) => {
    const {formatMessage} = useIntl()
    const {customer, paymentMethods} = useCheckout()

    const hasSavedCards = customer?.paymentInstruments?.length > 0
    const paymentMethodsMap = useCCVPaymentMethodsMap()

    const [isEditingPayment, setIsEditingPayment] = useState(!hasSavedCards)

    form = form || useForm()

    const [currentSelectedMethodId, setCurrentSelectedMethodId] = useState(
        form.getValues('paymentMethodId')
    )

    // Acts as our `onChange` handler for paymentInstrumentId radio group. We do this
    // manually here so we can toggle off the 'add payment' form as needed.
    const onPaymentIdChange = (value) => {
        console.log(form.getValues())
        if (value && isEditingPayment) {
            togglePaymentEdit()
        }
        form.reset({paymentInstrumentId: value})
    }

    const onPaymentMethodChange = (value) => {
        console.log('payment method change', value)
        setCurrentSelectedMethodId(value)
        form.setValue('ccvOption', '')
    }

    // Opens/closes the 'add payment' form. Notice that when toggling either state,
    // we reset the form so as to remove any payment selection.
    const togglePaymentEdit = () => {
        form.reset({paymentInstrumentId: ''})
        setIsEditingPayment(!isEditingPayment)
        form.trigger()
    }

    const test = (e) => {
        e.preventDefault()
        console.log(form.getValues())
        console.log(form)
        console.log(currentSelectedMethodId)
    }

    return (
        <form>
            <FormControl id="paymentMethodId" isInvalid={form.errors.paymentMethodId}>
                <FormErrorMessage marginTop={0} marginBottom={4}>
                    {form.errors.paymentMethodId?.message}
                </FormErrorMessage>
                <Stack spacing={8}>
                    <Stack spacing={5}>
                        <Box
                            border="1px solid"
                            borderColor="gray.100"
                            rounded="base"
                            overflow="hidden"
                        >
                            {/* credit card radio */}
                            <Controller
                                name="paymentMethodId"
                                defaultValue=""
                                control={form.control}
                                render={({onChange}) => (
                                    <RadioGroup
                                        onChange={(e) => {
                                            console.log(e)
                                            onChange(e)
                                            onPaymentMethodChange(e)
                                        }}
                                    >
                                        {/* dynamic payment methods */}
                                        {paymentMethods &&
                                            paymentMethods.applicablePaymentMethods.map(
                                                (paymentMethod) => {
                                                    return (
                                                        <Box key={paymentMethod.id}>
                                                            <Box
                                                                py={3}
                                                                px={[4, 4, 6]}
                                                                bg="gray.50"
                                                                borderColor="gray.100"
                                                            >
                                                                <Radio
                                                                    value={paymentMethod.id}
                                                                    marginTop="30px"
                                                                >
                                                                    <Stack direction="row">
                                                                        <Box>
                                                                            {paymentMethod.name}
                                                                        </Box>
                                                                        <PaymentMethodIcons
                                                                            paymentMethodId={
                                                                                paymentMethod.id
                                                                            }
                                                                            iconHeight="30px"
                                                                        />
                                                                    </Stack>
                                                                </Radio>
                                                            </Box>
                                                            {currentSelectedMethodId ===
                                                                paymentMethod.id && (
                                                                <CCVMethodOptions
                                                                    marginBottom="10px"
                                                                    paymentMethodId={
                                                                        currentSelectedMethodId
                                                                    }
                                                                    onPaymentIdChange={
                                                                        onPaymentIdChange
                                                                    }
                                                                    form={form}
                                                                    hideSubmitButton={
                                                                        hideSubmitButton
                                                                    }
                                                                    paymentMethodsMap={
                                                                        paymentMethodsMap
                                                                    }
                                                                    togglePaymentEdit={
                                                                        togglePaymentEdit
                                                                    }
                                                                    isEditingPayment={
                                                                        isEditingPayment
                                                                    }
                                                                />
                                                            )}
                                                        </Box>
                                                    )
                                                }
                                            )}
                                    </RadioGroup>
                                )}
                                rules={{
                                    required: formatMessage({
                                        defaultMessage: 'Please select a payment method.',
                                        id: 'payment_selection.message.select_payment_method'
                                    })
                                }}
                            />
                            <button onClick={test}>test</button>
                        </Box>
                    </Stack>
                </Stack>
            </FormControl>
        </form>
    )
}

PaymentSelection.propTypes = {
    /** The form object returnd from `useForm` */
    form: PropTypes.object,

    /** Show or hide the submit button (for controlling the form from outside component) */
    hideSubmitButton: PropTypes.bool,

    /** Callback for form submit */
    onSubmit: PropTypes.func
}

const CCVMethodOptions = function ({
    paymentMethodId,
    form,
    paymentMethodsMap,
    onPaymentIdChange,
    hideSubmitButton,
    togglePaymentEdit,
    isEditingPayment
}) {
    const {formatMessage} = useIntl()
    const selectedMethodData = paymentMethodsMap[paymentMethodId]
    const {customer} = useCheckout()
    const hasSavedCards = customer?.paymentInstruments?.length > 0

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
                        <FormErrorMessage marginTop={0} marginBottom={4}>
                            {form.errors.ccvOption?.message}
                        </FormErrorMessage>
                    </Controller>
                </FormControl>
            )
        }

        // case 'CCV_CREDIT_CARD': {
        //     const fields = {
        //         saveForLater: {
        //             name: `saveForLater`,
        //             label: formatMessage({
        //                 defaultMessage: 'Save card for later use',
        //                 id: 'payment_selection.message.save_card_for_later'
        //             }),
        //             type: 'checkbox',
        //             defaultValue: false,
        //             control: form.control
        //         }
        //     }
        //     return <Field {...fields.saveForLater} />
        // }
        case 'CCV_CREDIT_CARD': {
            return (
                <>
                    <Box p={[4, 4, 6]} borderBottom="1px solid" borderColor="gray.100">
                        <Stack spacing={6}>
                            {hasSavedCards && (
                                <Controller
                                    name="paymentInstrumentId"
                                    defaultValue=""
                                    control={form.control}
                                    rules={{
                                        required: !isEditingPayment
                                            ? formatMessage({
                                                  defaultMessage: 'Please select a payment method.',
                                                  id: 'payment_selection.message.select_payment_method'
                                              })
                                            : false
                                    }}
                                    render={({value}) => (
                                        <CCRadioGroup
                                            form={form}
                                            value={value}
                                            isEditingPayment={isEditingPayment}
                                            togglePaymentEdit={togglePaymentEdit}
                                            onPaymentIdChange={onPaymentIdChange}
                                        />
                                    )}
                                />
                            )}

                            {(isEditingPayment || !hasSavedCards) && (
                                <Box
                                    {...(hasSavedCards && {
                                        px: [4, 4, 6],
                                        py: 6,
                                        rounded: 'base',
                                        border: '1px solid',
                                        borderColor: 'blue.600'
                                    })}
                                >
                                    <Stack spacing={6}>
                                        {hasSavedCards && (
                                            <Heading as="h3" size="sm">
                                                <FormattedMessage
                                                    defaultMessage="Add New Card"
                                                    id="payment_selection.heading.add_new_card"
                                                />
                                            </Heading>
                                        )}

                                        <CreditCardFields form={form} />

                                        {!hideSubmitButton && (
                                            <Box>
                                                <Container variant="form">
                                                    <Button
                                                        isLoading={form.formState.isSubmitting}
                                                        type="submit"
                                                        w="full"
                                                    >
                                                        <FormattedMessage
                                                            defaultMessage="Save & Continue"
                                                            id="payment_selection.button.save_and_continue"
                                                        />
                                                    </Button>
                                                </Container>
                                            </Box>
                                        )}
                                    </Stack>
                                </Box>
                            )}
                        </Stack>
                    </Box>
                </>
            )
        }

        default:
            return <input type="hidden" {...form.register('ccvOption')} defaultValue="" />
    }
}

export default PaymentSelection
