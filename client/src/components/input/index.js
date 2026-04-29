import React from 'react'
const input = ({
    label ='',
    name='',
    type = 'text',
    classname='',
    inputclassname='',
    isrequired = true,
    placeholder = '',
    value = '',
    onChange = () => {},
}) => {
    return (
        <div className={`w-1/2 ${classname}`}> 
        <label htmlFor={name} className="block text-sm font-medium text-gray-800 dark:text-gray-200">{label}</label>
        <input type={type} id={name} className={`bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg
             focus:ring-blue-500 focus:border-blue-500 block w-full px-10 py-2.5 text-left transition-colors duration-300 ${inputclassname}`}
             placeholder={placeholder} required={isrequired} value={value} onChange={onChange}/>
        </div>
    )
}
export default input;