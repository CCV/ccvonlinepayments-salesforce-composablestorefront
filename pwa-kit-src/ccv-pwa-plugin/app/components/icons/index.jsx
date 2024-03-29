/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {forwardRef} from 'react'
import {Icon, useTheme} from '@chakra-ui/react'

/**
 * A helper for creating a Chakra-wrapped icon from our own SVG imports via sprite sheet.
 * @param {string} name - the filename of the imported svg (does not include extension)
 */
/* istanbul ignore next */
const icon = (name, passProps) => {
    const displayName = name
        .toLowerCase()
        .replace(/(?:^|[\s-/])\w/g, (match) => match.toUpperCase())
        .replace(/-/g, '')
    const component = forwardRef((props, ref) => {
        const theme = useTheme()
        const baseStyle = theme?.components?.Icon?.baseStyle
        return (
            <Icon ref={ref} {...baseStyle} {...passProps} {...props}>
                <use role="presentation" xlinkHref={`#${name}`} />
            </Icon>
        )
    })
    component.displayName = `${displayName}Icon`
    return component
}

// ==================== CCV ICONS ====================
import IdealSymbol from '../../assets/svg/ideal-logo.svg'
import BancontactSymbol from '../../assets/svg/bancontact-logo.svg'
import GiropaySymbol from '../../assets/svg/giropay-logo.svg'
import SofortSymbol from '../../assets/svg/sofort-logo.svg'
import EPSSymbol from '../../assets/svg/eps-logo.svg'
import PayconiqSymbol from '../../assets/svg/payconiq-logo.svg'
import MaestroSymbol from '../../assets/svg/maestro-logo.svg'
import KlarnaSymbol from '../../assets/svg/klarna-logo.svg'
import ApplePaySymbol from '../../assets/svg/apple-pay-logo.svg'

IdealSymbol.viewBox = IdealSymbol.viewBox || '0 0 306.1 269.8'
BancontactSymbol.viewBox = BancontactSymbol.viewBox || '0 0 326.1 230.5'
GiropaySymbol.viewBox = GiropaySymbol.viewBox || '0 0 38 22'
SofortSymbol.viewBox = SofortSymbol.viewBox || '0 0 746.1 286.2'
EPSSymbol.viewBox = EPSSymbol.viewBox || '0 0 889 577'
PayconiqSymbol.viewBox = PayconiqSymbol.viewBox || '0 0 326 230.5'
MaestroSymbol.viewBox = MaestroSymbol.viewBox || '0 0 125 120'
KlarnaSymbol.viewBox = KlarnaSymbol.viewBox || '0 0 100 40.4494'
ApplePaySymbol.viewBox = ApplePaySymbol.viewBox || '0 0 165.52107 105.9651'

// Export Chakra icon components that use our SVG sprite symbol internally
// For non-square SVGs, we can use the symbol data from the import to set the
// proper viewBox attribute on the Icon wrapper.
export const IdealIcon = icon('ideal-logo', {viewBox: IdealSymbol.viewBox})
export const BanContactIcon = icon('bancontact-logo', {viewBox: BancontactSymbol.viewBox})
export const GiropayIcon = icon('giropay-logo', {viewBox: GiropaySymbol.viewBox})
export const SofortIcon = icon('sofort-logo', {viewBox: SofortSymbol.viewBox})
export const EPSIcon = icon('eps-logo', {viewBox: EPSSymbol.viewBox})
export const PayconiqIcon = icon('payconiq-logo', {viewBox: PayconiqSymbol.viewBox})
export const MaestroIcon = icon('maestro-logo', {viewBox: MaestroSymbol.viewBox})
export const KlarnaIcon = icon('klarna-logo', {viewBox: KlarnaSymbol.viewBox})
export const ApplePayIcon = icon('apple-pay-logo', {viewBox: ApplePaySymbol.viewBox})

export * from '@salesforce/retail-react-app/app/components/icons'
