import { useState } from 'react';
import Input from '../../components/input';
import Button from '../../components/button';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const Form = ({
    isSignedInPage=false,
}) => {
    const[data,setData]=useState({
        ...(!isSignedInPage && {
            fullName:''
        }),
        email:'',
        password:''
    })
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${BACKEND_URL}/api/${isSignedInPage ? 'login' : 'register'}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if(res.status === 400 || res.status === 500) {
                const message = await res.text();
                alert(message);
            } else {
                if(isSignedInPage) {
                    const resData = await res.json();
                    if(resData.token) {
                        localStorage.setItem('user:token', resData.token);
                        localStorage.setItem('user:detail', JSON.stringify(resData.user));
                        navigate('/');
                    }
                } else { // registered successfully
                    alert('Register success, please login');
                    navigate('/users/sign_in');
                }
            }
        } catch (err) {
            console.log(err);
        }
    }

    return (
        <div className="bg-light dark:bg-gray-900 h-screen flex items-center justify-center transition-colors duration-300">
        <div className="bg-gray-50 dark:bg-gray-800 w-[450px] h-[600px] shadow-lg rounded-lg flex flex-col justify-center items-center transition-colors duration-300">
            <div className="text-4xl font-extrabold text-black dark:text-white transition-colors duration-300">Welcome {isSignedInPage && 'Back'}</div>
            <div className="text-xl font-light mb-14 dark:text-gray-400 transition-colors duration-300">{isSignedInPage ? 'Sign in now to get explored' : 'Sign up now to get started'}</div>
            <form className="flex flex-col items-center w-full gap-6" onSubmit={handleSubmit}>
            {! isSignedInPage &&  <Input label="Fullname" name="fullName" placeholder="Enter your fullname" className="mb-6 w-[50%]" value={data.fullName} onChange={(e) => setData({...data, fullName: e.target.value})}/>}
            <Input label="Email" name="email" placeholder="Enter your email" className="mb-6 w-[50%]" value={data.email} onChange={(e) => setData({...data, email: e.target.value})}/>
            <Input label="Password" type="password" name="password" placeholder="Enter your password" className="mb-14 w-[50%]" value={data.password} onChange={(e) => setData({...data, password: e.target.value})}/>
            <Button label={isSignedInPage ? 'Sign In' : 'Sign Up'} type='submit' className="w-1/2 mb-2 "/>
            </form>
            <div className="dark:text-gray-300 transition-colors duration-300">{isSignedInPage ? "Didn't have an Account?" : "Already have an Account?"} <span className="text-primary cursor-pointer underline" 
            onClick={() => navigate(`/users/${isSignedInPage ? 'sign_up' : 'sign_in'}`)}>{isSignedInPage ? 'Sign Up' : 'Sign In'}
            </span></div>
        </div>
        </div>

    )
}
export default Form;