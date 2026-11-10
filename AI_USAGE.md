# AI Usage Declaration

AI tools were used as supplementary development resources during the implementation of this project. DeepSeek / ChatGPT was primarily used to assist with initial project setup, code development, debugging, and technical problem-solving.

All AI-assisted outputs were reviewed and adapted to the project's requirements. I remained responsible for the implementation decisions, code modifications, testing, and final project submission.

## 1. AI Tool Used

- **DeepSeek / ChatGPT:** Used for development assistance, code suggestions, debugging support, and technical guidance.

## 2. Areas Where AI Assistance Was Used

**Backend Development**
- Assisted with setting up the initial .NET 8 project structure.
- Provided guidance on implementing PostgreSQL database operations using Dapper.
- Helped with transaction handling and database-level locking using `SELECT ... FOR UPDATE` to protect seat availability during concurrent requests.

**Frontend Development**
- Assisted with setting up the React application using Vite.
- Provided initial component and UI implementation suggestions for the Admin Panel and Student Dashboard.
- Helped develop polling functionality for displaying seat availability and hold countdowns.

**Docker and Deployment Configuration**
- Assisted with preparing the backend and frontend Dockerfiles.
- Provided guidance on configuring Nginx for frontend delivery.
- Helped configure Docker Compose to run PostgreSQL, the backend API, and the frontend application as a coordinated environment.

## 3. AI-Generated Issues and My Corrections

**Docker Build Configuration**

The initial Dockerfile configuration did not match the actual project directory structure because the `.csproj` file was located inside the `SchoolAdmission.Api/` directory rather than the repository root. I reviewed the build configuration and adjusted the file paths and Docker `COPY` instructions accordingly.

**Concurrency Test Assertions**

The initial concurrency test implementation did not adequately distinguish expected `409 Conflict` responses from unexpected server errors. I reviewed the test logic and revised the assertions to validate the seat allocation rules, including the expected number of successful holds and the resulting database seat counts. Unexpected server responses must be investigated rather than treated as successful outcomes.

**Frontend API Configuration**

The initial frontend implementation used a fixed localhost API address. I reviewed the configuration and updated the API URL handling to support environment-based settings. I also reviewed the frontend and backend communication configuration to ensure compatibility with the Docker deployment setup.

## 4. Testing and Responsibility

I reviewed the generated suggestions, modified the implementation where necessary, and used automated tests to evaluate the application's functionality and business rules.

AI assistance was limited to development support. The final implementation, technical decisions, testing, and submitted work remain my responsibility.
