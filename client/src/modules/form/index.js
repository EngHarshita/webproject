import { useState } from 'react';
import Input from '../../components/input';
import Button from '../../components/button';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5000');

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
    const [isLoading, setIsLoading] = useState(false);
    // FIX: Added inline error state instead of alert() to prevent UI freeze & improve UX
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    // FIX: Removed useEffect that wiped localStorage on every sign-in page load.
    // That hook was destroying a valid session whenever the user just visited the login page,
    // breaking the "stay logged in" feature and causing unnecessary 401 errors on refresh.

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isLoading) return;
        setErrorMsg(''); // Clear previous error on new submit
        setIsLoading(true);

        try {
            const res = await fetch(`${BACKEND_URL}/api/${isSignedInPage ? 'login' : 'register'}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            // FIX: Was checking only status 400/500/503. Any other error code (401, 409, etc.)
            // fell into the 'else' block and tried to parse it as a success, causing a freeze.
            // Now we correctly use res.ok which covers all 2xx success codes.
            if (!res.ok) {
                let errMessage = 'Something went wrong. Please try again.';
                try {
                    const errorData = await res.json();
                    errMessage = errorData.error || errMessage;
                } catch(e) {
                    errMessage = await res.text() || errMessage;
                }
                setErrorMsg(errMessage);
                return;
            }

            if(isSignedInPage) {
                const resData = await res.json();
                if(resData && resData.token && resData.user) {
                    localStorage.setItem('user:token', resData.token);
                    localStorage.setItem('user:detail', JSON.stringify(resData.user));
                    navigate('/');
                } else {
                    setErrorMsg('Login failed: Invalid response from server. Please try again.');
                }
            } else { // registered successfully
                alert('Account created successfully! Please sign in.');
                navigate('/users/sign_in');
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setErrorMsg('Connection failed. Please ensure the server is running.');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="bg-light dark:bg-gray-900 h-screen flex items-center justify-center transition-colors duration-300">
        <div className="bg-gray-50 dark:bg-gray-800 w-[450px] shadow-lg rounded-lg flex flex-col justify-center items-center py-12 px-8 transition-colors duration-300">
            <div className="text-4xl font-extrabold text-black dark:text-white transition-colors duration-300 mb-2">Welcome {isSignedInPage && 'Back'}</div>
            <div className="text-xl font-light mb-8 dark:text-gray-400 transition-colors duration-300">{isSignedInPage ? 'Sign in now to get explored' : 'Sign up now to get started'}</div>
            {/* Inline error banner - no more freezing alert() dialogs */}
            {errorMsg && (
                <div className="w-full mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg text-sm text-center">
                    ⚠️ {errorMsg}
                </div>
            )}
            <form className="flex flex-col items-center w-full gap-4" onSubmit={handleSubmit}>
            {! isSignedInPage &&  <Input label="Fullname" name="fullName" placeholder="Enter your fullname" className="w-[75%]" value={data.fullName} onChange={(e) => setData({...data, fullName: e.target.value})}/>}
            <Input label="Email" name="email" type="email" placeholder="Enter your email" className="w-[75%]" value={data.email} onChange={(e) => setData({...data, email: e.target.value})}/>
            <Input label="Password" type="password" name="password" placeholder="Enter your password" className="mb-6 w-[75%]" value={data.password} onChange={(e) => setData({...data, password: e.target.value})}/>
            <Button label={isLoading ? 'Please wait...' : (isSignedInPage ? 'Sign In' : 'Sign Up')} type='submit' className="w-[75%] mb-2 " disabled={isLoading}/>
            </form>
            <div className="dark:text-gray-300 transition-colors duration-300 mt-4">{isSignedInPage ? "Didn't have an Account?" : "Already have an Account?"} <span className="text-primary cursor-pointer underline" 
            onClick={() => navigate(`/users/${isSignedInPage ? 'sign_up' : 'sign_in'}`)}>{isSignedInPage ? 'Sign Up' : 'Sign In'}
            </span></div>
        </div>
        </div>

    )
}
export default Form;