import React, { useRef, useState } from 'react'  // Import React, useRef, useState
import { useSnackbar } from 'notistack'  // Import useSnackbar from notistack
import { CircularProgress, FormControl, FormHelperText, IconButton, TextField } from '@material-ui/core'  // Import Material-UI components
import { Folder } from '@material-ui/icons'  // Import Folder icon from Material-UI icons
import { Controller } from 'react-hook-form'  // Import Controller from react-hook-form
import Cookies from 'js-cookie'  // Import Cookies for authentication
import { parseResponse } from 'utils/api'  // Import custom API response parser
import { isProd } from 'utils/functions'  // Import utility to check environment (production or not)

const SUPPORTED_IMAGE_FORMATS = ['image/jpg', 'image/jpeg', 'image/png']  // Define supported image formats

const ImageUpload = ({
  control,
  error,
  name = 'offerImage',
  placeholder = 'Cover image',
  uploadUrl,
  gptToken = '...', // Default GPT token
}) => {
  const inputRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
  const { enqueueSnackbar } = useSnackbar()

  // Function to send the image to GPT for verification
  const checkImageWithGPT = async (imageBase64) => {
    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gptToken}`,  // Use the provided GPT token
        },
        body: JSON.stringify({
          input: imageBase64,  // Send the base64-encoded image
        }),
      });
      
      const data = await response.json();
      if (data && data.results && data.results[0].flagged) {
        // GPT flagged the image
        return { success: false, message: 'This image contains inappropriate content.' };
      }

      // Image is clean
      return { success: true };
    } catch (error) {
      console.error('Error checking image content with GPT:', error);
      return { success: false, message: 'Error checking image content. Please try again.' };
    }
  };

  const handleImageSelect = async (e, callback) => {
    const files = e.target.files
    if (!SUPPORTED_IMAGE_FORMATS.includes(files[0].type)) {
      enqueueSnackbar('Please choose only .jpg or .png images', { variant: 'error' })
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      if (reader.result) {
        // Call GPT moderation check before uploading
        const result = await checkImageWithGPT(reader.result);
        if (result.success) {
          // If the image passes the check, proceed with the upload
          uploadLogo(files[0], callback);
        } else {
          // If the image fails the check, display an error message
          enqueueSnackbar(result.message, { variant: 'error' });
        }
      }
    }
    reader.readAsDataURL(files[0])  // Read file as base64 to send to GPT
  }

  const uploadLogo = (img, callback) => {
    const formData = new FormData()
    formData.append('file', img)
    setIsUploading(true)
    fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${Cookies.get('access_token') || ''}`,  // Use Cookies for auth
      },
      mode: 'cors',
      withCredentials: true,
      credentials: 'include',
    })
    .then(res => parseResponse(res))  // Parse response
    .then((response) => {
      enqueueSnackbar('Image uploaded', { variant: 'success'})
      const host = isProd() ? window.location.origin : 'https://staging.hiddenunderground.com'
      const url = `${host}${response.result}`
      callback(url)
    })
    .catch(() => {
      enqueueSnackbar('Cannot upload image, please try again', { variant: 'error'})
    })
    .finally(() => {
      setIsUploading(false)
    })
  }

  const handleClick = () => {
    if (!inputRef || !inputRef.current) {
      return
    }
    inputRef.current.click()
  }

  return (
    <>
      <FormControl fullWidth variant="outlined" margin="dense">
        <Controller
          control={control}
          name={name}
          render={({ value, onChange }) => (
            <>
              <TextField
                label={value == null ? placeholder : ""}
                inputProps={{ disabled: true }}
                InputProps={{
                  endAdornment: isUploading ? 
                    <CircularProgress size={20} />
                    :
                    <IconButton onClick={handleClick} size="small"><Folder /></IconButton>
                }}
                variant="outlined"
                margin="dense"
                value={value}
              />
              <input
                accept=".png,.jpg,.jpeg"
                onChange={(e) => handleImageSelect(e, onChange)}
                ref={inputRef}
                type="file"
                style={{
                  visibility: 'hidden',
                  width: 0,
                  position: 'absolute',
                }}
              />
            </>
          )}
        />
        {
          error &&
          <FormHelperText error>
            {error.message}
          </FormHelperText>
        }
      </FormControl>
    </>
  )
}

export default ImageUpload