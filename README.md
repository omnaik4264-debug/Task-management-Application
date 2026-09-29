# TaskFlow — Task Management Application

A complete full-stack internship Task 2 project that runs from one folder in VS Code.

## Task requirements covered

- User authentication: Register and Login
- Authorization: each account can access only its own tasks
- CRUD operations: Create, Read, Update and Delete tasks
- REST API integration between frontend and backend
- Real-time task refresh using Server-Sent Events (SSE)
- Responsive desktop and mobile design
- Dynamic data handling and persistent storage
- Search and filtering
- Task priority, status and due dates
- Dashboard statistics
- Secure password hashing using Node.js `crypto.scrypt`

## Technology

- Frontend: HTML5, CSS3, JavaScript
- Backend: Node.js built-in HTTP server
- API: REST
- Storage: JSON file (`data/db.json`)
- Authentication: signed session token + scrypt password hashing
- Real-time updates: Server-Sent Events
- Version control: Git / GitHub

No external npm packages are required.

## How to run in VS Code

1. Install Node.js if it is not already installed.
2. Open this complete folder in VS Code.
3. Open Terminal > New Terminal.
4. Run:

```bash
npm start
```

5. Open this address in your browser:

`http://localhost:3000`

6. Register a new account and test the application.

## Testing checklist

1. Register
2. Logout and Login
3. Create a task
4. Edit a task
5. Change its status
6. Search/filter tasks
7. Delete a task
8. Resize browser/mobile view
9. Create another user and confirm the first user's tasks are not visible

## GitHub upload

Create an empty GitHub repository. Then in the VS Code terminal:

```bash
git init
git add .
git commit -m "Task 2 - Task Management Application"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

## Project structure

```text
task-management-app-complete/
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── data/
│   └── db.json
├── server.js
├── package.json
├── .gitignore
└── README.md
```

## API endpoints

- POST `/api/register`
- POST `/api/login`
- GET `/api/me`
- GET `/api/tasks`
- POST `/api/tasks`
- PUT `/api/tasks/:id`
- DELETE `/api/tasks/:id`
- GET `/api/events`

## Reference

Task tutorial supplied for the internship task:
https://youtu.be/Q4aB0IgKYx0

The tutorial is listed as a learning/reference resource. This submission includes its own full-stack implementation with authentication, authorization, REST API, persistent storage and real-time updates.

## Note

This project is designed for internship/academic demonstration. For a public production deployment, use a production database, HTTPS, environment-managed secrets, rate limiting and hardened session management.
