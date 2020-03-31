import bech32 from 'bech32'
import { TFunction } from 'i18next'
import { gt, lte, isInteger } from '../utils/math'
import { toAmount } from '../utils/format'

const validateForm = (t: TFunction) => {
  const between = (
    input: string,
    { range: [min, max], label }: { range: (string | number)[]; label: string }
  ): string =>
    !input
      ? t('Common:Validate:{{label}} is required', { label })
      : !(gt(input, min) && lte(input, max))
      ? t('Common:Validate:{{label}} must be between {{min}} and {{max}}', {
          label,
          min,
          max
        })
      : ''

  return {
    between,

    input: (input: string, { max }: { max: string }): string =>
      !gt(max, 0)
        ? t('Common:Validate:Insufficient balance')
        : !isInteger(toAmount(input))
        ? t('Common:Validate:{{label}} must be within 6 decimal points', {
            label: t('Common:Tx:Amount')
          })
        : between(input, { range: [0, max], label: t('Common:Tx:Amount') }),

    address: (to: string) =>
      !to
        ? t('Common:Validate:{{label}} is required', {
            label: t('Common:Account:Address')
          })
        : !isAddress(to)
        ? t('Common:Validate:{{label}} is invalid', {
            label: t('Common:Account:Address')
          })
        : '',

    password: (password: string) =>
      !password.length
        ? t('Common:Validate:{{label}} is required', {
            label: t('Auth:Form:Password')
          })
        : password.length < 10
        ? t(
            'Common:Validate:{{label}} must be longer than {{min}} characters',
            { label: t('Auth:Form:Password'), min: 10 }
          )
        : '',

    length: (text: string, { max, label }: { max: number; label: string }) =>
      new Blob([text]).size > max
        ? t('Common:Validate:{{label}} is too long', { label })
        : ''
  }
}

/* validate:address */
const isBech32 = (value: string) => {
  try {
    const words = bech32.decode(value)
    return words.prefix === `terra`
  } catch (error) {
    return false
  }
}

export const isAddress = (string: string = ''): boolean =>
  string.length === 44 && string.startsWith('terra') && isBech32(string)

/* validate:confirm */
export const validateConfirm = (
  { password, confirm }: { password: string; confirm: string },
  t: TFunction
): { password: string; confirm: string } => ({
  password: validateForm(t).password(password),
  confirm:
    password !== confirm ? t('Common:Validate:Password does not match') : ''
})

export default validateForm
