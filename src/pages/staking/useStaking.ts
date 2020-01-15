import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { path } from 'ramda'
import { User } from '../../types'
import { StakingUI, StakingPersonal } from '../../types'
import { StakingData, StakingPage, StakingDelegation } from '../../types'
import { ValidatorSorter, Undelegation } from '../../types'
import { format } from '../../utils'
import { sum, plus, minus } from '../../utils'
import { gte, gt, isFinite, toNumber } from '../../utils'
import useFCD from '../../api/useFCD'
import useValidatorItem from './useValidatorItem'

const denom = 'uluna'
export default (user?: User): StakingPage => {
  const { t } = useTranslation()
  const renderValidatorItem = useValidatorItem()
  const calcUndelegationTotal = (undelegations?: Undelegation[]) =>
    undelegations?.length ? sum(undelegations.map(u => u.amount)) : '0'

  /* api */
  const url = user ? `/v1/staking/${user.address}` : '/v1/staking'
  const response = useFCD<StakingData>({ url })

  /* render */
  const renderPersonal = ({
    rewards,
    ...rest
  }: StakingData): StakingPersonal => {
    const { undelegations, availableLuna, delegationTotal } = rest
    const { myDelegations } = rest

    const undelegationTotal = calcUndelegationTotal(undelegations)

    const getMyDelegationsTable = (title: string, sortKey: SortKey) => {
      const getChart = (d: StakingDelegation) => ({
        label: d.validatorName,
        data: format.amountN(d[sortKey] ?? '0')
      })

      const sorted = myDelegations?.sort(compareWith(sortKey)) ?? []
      const converted = sorted.map(getChart)
      const othersSum = sorted
        .slice(4)
        .reduce((total, d) => plus(total, d[sortKey] ?? '0'), '0')
      const others = { label: 'Others', data: format.amountN(othersSum) }

      const calcSum = (): string => {
        const src = sorted.map(d => d[sortKey] ?? '0').filter(isFinite)
        return src.length ? sum(src) : '0'
      }

      return !myDelegations?.length
        ? undefined
        : {
            title,
            sum: format.display({ amount: calcSum(), denom }),
            table: {
              headings: {
                name: t('Page:Staking:Validator'),
                delegated: `${t('Page:Staking:Delegated')} (Luna)`,
                rewards: `${t('Page:Staking:Rewards')} (Luna)`
              },
              contents: sorted.map(d => ({
                address: d.validatorAddress,
                name: d.validatorName,
                delegated: format.display({ amount: d.amountDelegated, denom }),
                rewards: format.display({ amount: d.totalReward ?? '0', denom })
              }))
            },
            chart:
              sorted.length <= 5
                ? converted
                : converted.slice(0, 4).concat(others)
          }
    }

    return {
      withdrawAll: {
        attrs: {
          children: t('Page:Staking:Withdraw all rewards'),
          disabled: !(rewards && gte(rewards.total, 1))
        },
        amounts: rewards?.denoms.map(coin => format.display(coin)) ?? []
      },
      available: {
        title: t('Page:Staking:Available for delegation'),
        display: format.display({ amount: availableLuna ?? '0', denom })
      },
      delegated: {
        title: t('Page:Staking:Delegated assets'),
        display: format.display({ amount: delegationTotal ?? '0', denom })
      },
      undelegated: {
        title: t('Page:Staking:Undelegated assets'),
        display: format.display({ amount: undelegationTotal ?? '0', denom }),
        table: !undelegations?.length
          ? undefined
          : {
              headings: {
                name: t('Page:Staking:Validator'),
                display: `${t('Common:Tx:Amount')} (Luna)`,
                date: t('Page:Staking:Release time')
              },
              contents: undelegations.map(u => ({
                name: u.validatorName,
                display: format.display({ amount: u.amount, denom }),
                date: format.date(u.releaseTime)
              }))
            }
      },
      rewards: {
        title: t('Page:Staking:Rewards'),
        display: format.display({ amount: rewards?.total ?? '0', denom }),
        table: !rewards?.denoms.length
          ? undefined
          : {
              headings: {
                unit: t('Common:Coin'),
                value: t('Common:Tx:Amount')
              },
              contents: rewards.denoms.map(r => format.display(r))
            }
      },
      myDelegations: getMyDelegationsTable(
        t('Page:Staking:Delegated'),
        'amountDelegated'
      ),
      myRewards: getMyDelegationsTable(t('Page:Staking:Rewards'), 'totalReward')
    }
  }

  /* validators */
  const DefaultSorter: ValidatorSorter = { prop: 'stakingReturn' }
  const [sorter, setSorter] = useState<ValidatorSorter>(DefaultSorter)
  const [asc, setAsc] = useState<boolean>(false)
  const { prop, isString } = sorter

  const renderValidators = (staking: StakingData): StakingUI => {
    const { validators, delegationTotal = '0', undelegations } = staking
    const undelegationTotal = calcUndelegationTotal(undelegations)
    const total = plus(delegationTotal, undelegationTotal)

    const sorted = validators
      .filter(v => {
        const delegated = v.myDelegation && gt(v.myDelegation, 0)
        const hidden = v.status === 'jailed' && !delegated
        return !hidden
      })
      .sort((validatorA, validatorB) => {
        const a: string = String(path(prop.split('.'), validatorA) || 0)
        const b: string = String(path(prop.split('.'), validatorB) || 0)
        const c = asc ? 1 : -1
        const compareString = c * (a.toLowerCase() > b.toLowerCase() ? 1 : -1)
        const compareNumber = c * (gt(a, b) ? 1 : -1)
        return a === b ? 0 : isString ? compareString : compareNumber
      })
      .map((validator, index) =>
        renderValidatorItem(validator, { index, total })
      )

    return {
      sorter: {
        current: { ...sorter, asc },
        set: (sorter, asc) => {
          setSorter(sorter)
          setAsc(asc)
        }
      },
      headings: {
        rank: {
          title: t('Page:Staking:Rank')
        },
        moniker: {
          title: t('Page:Staking:Moniker'),
          sorter: { prop: 'description.moniker', isString: true }
        },
        votingPower: {
          title: t('Page:Staking:Voting power'),
          sorter: { prop: 'votingPower.weight' }
        },
        commission: {
          title: t('Page:Staking:Validator commission'),
          sorter: { prop: 'commissionInfo.rate' }
        },
        delegationReturn: {
          title: t('Page:Staking:Delegation return'),
          sorter: { prop: 'stakingReturn' }
        },
        uptime: {
          title: t('Page:Staking:Uptime'),
          sorter: { prop: 'upTime' }
        },
        myDelegation: {
          title: t('Page:Staking:My delegations'),
          sorter: { prop: 'myDelegation' }
        }
      },
      contents: sorted
    }
  }

  return Object.assign(
    {},
    response,
    user && response.data && { personal: renderPersonal(response.data) },
    response.data && { ui: renderValidators(response.data) }
  )
}

/* helpers */
type SortKey = keyof StakingDelegation
const compareWith = (key: SortKey) => (
  a: StakingDelegation,
  b: StakingDelegation
) => toNumber(minus(b[key] ?? '0', a[key] ?? '0'))
