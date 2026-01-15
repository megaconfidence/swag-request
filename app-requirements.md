# App requirements

A simple app with a form where users can submit their name, email, shipping address and phone number to receive Cloudflare swag.

The landing page should be a beautiful Cloudflare themed form where users can enter in their details. It should have the necessary form validation implemented for each field. The submitted form should also be validated on the server-side. After submitting, users should be told that their request was successfully submitted and that if approved, further communications with be sent with their provided email addresses. They should also be told that privacy reasons their data is automatically deleted after 1 week. The user’s data should be stored in Workers D1 with at TTL of 1 week.

The app should have an admin route where submitted requests can be viewed. With this dashboard, admins can delete a request or approve a request. When a request is approved, email notification is sent to the requester letting them know that their swag request was approved. The app should use https://resend.com/ for sending out email. On the admin panel, approved requests should be downloadable as CSVs.

The landing page should have an admin login link which only allows users with @cloudflare.com email addresses to login. It sends an OTP email to the provided email address to authenticate the user.

Other requirements for the app is that a user can only have a maximum of 10 request in the app. And should be informed when this limit is reached.

# Technology stack

- The UI component of the application should mobile responsive and be built in HTML and Tailwind CSS
- Workers D1 should be used to store the users dater for 1 week
- https://resend.com/ should be used for sending out email
