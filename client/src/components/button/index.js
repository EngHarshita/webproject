import React from 'react';
const Button = ({
    label = 'button', 
    type = 'button',
    classname = '',
    disabled = false,

}) => {
    return (
        <button type={type} className={`text-white bg-primary hover:bg-primary border border-primary focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-auto px-20 py-2.5 text-center  ${classname}`} disabled={disabled}>
        {label}</button>
    )
}
export default Button