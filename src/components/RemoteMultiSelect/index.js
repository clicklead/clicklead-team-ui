import React, {Component} from 'react'
import _ from 'lodash'
import {Icon} from 'antd';

const EMPTY_VALUE = '{%empty%}';

export default class RemoteMultiSelect extends Component {
    constructor(props) {
        super(props)
        this.state = {
            isLoading: false,
            isOpen: false,
            value: [],
            valueData: [],
            data: []
        }
        this._onSearch = _.debounce(this._onSearch, 250)
    }

    componentDidMount = () => {
        this.fetchValue()
        document.addEventListener('mousedown', this.handleClickOutside)
    }

    componentWillUnmount = () => {
        document.removeEventListener('mousedown', this.handleClickOutside)
    }

    componentDidUpdate = (prevProps) => {
        const {value, data} = this.state
        const {disabled, params} = this.props
        if (this.props.hasOwnProperty('params')) {
            const paramsChanged = !_.isEqual(params, prevProps.params)
            if (paramsChanged && !disabled) {
                // родитель изменен и селект стал доступен
                this.fetchValue()
                this.fetch()
            } else if (paramsChanged) {
                // родитель изменен и пуст, заблокирован селект
                console.log('params changed, disable')
                this.setState({value: [], valueData: [], data: []})
            }
        }
    }

    setWrapperRef = (node) => {
        this.wrapperRef = node
    }

    setSearchRef = (node) => {
        this.searchRef = node
    }

    handleClickOutside = (event) => {
        const {isOpen, value} = this.state
        if (isOpen && this.wrapperRef && !this.wrapperRef.contains(event.target)) {
            const search_value = this.searchRef && this.searchRef.value
            if (search_value) {
                this.searchRef.value = ''
                this.fetch();
            }
            this.setState({isOpen: false});
            const isEmptyValue = _.isEmpty(this.props.value) && _.isEmpty(value);
            if (!isEmptyValue && !_.isEqual(this.props.value, value)) {
                this.props.onChange(value.slice());
            }
        }
    }

    fetchValue = () => {
        const {value, target, filter, params: options} = this.props
        if (!value || !value.length) return
        const params = {
            'q[id][in]': value.join(','),
            'fields': 'id,name'
        }

        // params
        if (options && typeof options === 'object') {
            Object.keys(options).forEach(key => {
                params[key] = Array.isArray(options[key]) ? options[key].join(',') : options[key]
            })
        }

        const url = filter && `v1/statistic-light-filters/${filter}` || target
        window.api.get(url, {params: params})
            .then(response => {
                this.setState({valueData: response.data, value: value, isLoading: false})
            })
            .catch(e => {
                this.setState({isLoading: false})
            })
    }

    fetch = (search_value) => {
        const {filter, target, params: options} = this.props
        const {isLoading} = this.state;
        let values = this.state.value.slice();
        if (isLoading) return
        this.setState({isLoading: true})

        const params = {
            'fields': 'id,name'
        }

        // search
        if (search_value) {
            if (search_value.charAt(0) === '#') {
                params['q[id][equal]'] = search_value.replace('#', '')
            } else {
                params['q[name][like]'] = search_value
            }
        }

        // params
        if (options && typeof options === 'object') {
            Object.keys(options).forEach(key => {
                params[key] = Array.isArray(options[key]) ? options[key].join(',') : options[key]
            })
        }

        const url = filter && `v1/statistic-light-filters/${filter}` || target
        window.api.get(url, {params: params})
            .then(response => {
                // sort items
                const data = response.data.sort((itemA, itemB) => {
                    return itemA.id - itemB.id;
                });

                // region ---- move empty value to first in data
                const emptyItem = data.find((item) => item.id === EMPTY_VALUE);
                if (emptyItem) {
                    const emptyItemIndex = data.findIndex((item) => item.id === EMPTY_VALUE);
                    data.splice(emptyItemIndex, 1);
                    data.unshift(emptyItem);
                }
                // ---- endregion

                if (values) {
                    values = values.filter((value) => {
                        return !!data.find((item) => String(item.id) === String(value));
                    });
                }

                this.setState({data: data, value: values, isLoading: false});
            })
            .catch(e => {
                this.setState({isLoading: false})
            })
    }

    _onSearch = () => {
        const {data} = this.state
        const tmp = this.searchRef.value
        if (!tmp || tmp === ' ') {
            // if clear input
            this.searchRef.value = ''
            this.fetch()
        } else {
            const search_value = tmp.replace(/^\s\s*/, '').replace(/\s\s*$/, '') // trim start & end
            if (search_value) {
                this.fetch(search_value)
            } else {
                this.searchRef.value = ''
            }
        }
    }

    _onSelect = (e) => {
        const {changeOnSelect, onChange} = this.props;
        const inputValue = e.target.value;

        let id = parseInt(inputValue);
        if (Number.isNaN(id)) {
            id = inputValue;
        }

        const name = e.target.dataset.name
        let {value, valueData} = this.state

        if (value.includes(inputValue)) {
            value.splice(value.indexOf(inputValue), 1)
            valueData = valueData.filter(item => item.id !== inputValue)
        } else {
            value.push(inputValue)
            valueData.push({inputValue, name})
        }

        this.setState({value, valueData})

        // clear search
        const search = this.searchRef
        if (search && search.value) {
            search.value = ''
            this.fetch()
        }

        if (changeOnSelect) {
            onChange(value);
        }
    }

    _renderValues = () => {
        const {value, valueData, data} = this.state
        const search_value = this.searchRef && this.searchRef.value || false
        const values = []

        data.forEach((item, index) => {
            const checked = !!value.includes(String(item.id));

            values.push(
                <li key={index}>
                    <label>
                        <input type='checkbox' value={item.id} data-name={item.name} onChange={this._onSelect}
                               checked={checked}/>
                        <span>{index}.</span>
                        {item.name}
                    </label>
                </li>
            )
        })

        return values
    }

    _toggle = () => {
        const {value, isOpen, data} = this.state
        this.setState({isOpen: !isOpen})
        if (!isOpen && data.length === 0) this.fetch()
        if (isOpen) {
            this.props.onChange(value)
        }
    }

    render() {
        const {value, isLoading, isOpen} = this.state
        const {disabled, hideIds} = this.props
        const values = this._renderValues()

        let className = `mselect`
        if (isOpen) className += ` mselect-isOpen`
        if (hideIds) className += ` mselect-hideIds`
        if (disabled) className += ` mselect-disabled`

        return (
            <div className={className} ref={this.setWrapperRef}>
                <div className='mselect__value' onClick={this._toggle}>
                    {value.length ? `Выбрано ${value.length} шт.` :
                        <div className='mselect__value-placeholder'>Все</div>}
                    <Icon className="mselect__value-icon" type="down"/>
                </div>
                {isOpen && (
                    <div className='mselect__dropdown'>
                        <input ref={this.setSearchRef} type='text' className='mselect__dropdown-search'
                               onChange={this._onSearch} placeholder='Поиск...'/>
                        <ul className='mselect__dropdown-values'>
                            {isLoading
                                ? <li className='mselect__dropdown-values-loading'>Загрузка...</li>
                                : (values.length ? values :
                                    <li className='mselect__dropdown-values-empty'>Ничего не найдено</li>)
                            }
                        </ul>
                    </div>
                )}
            </div>
        )
    }
}
