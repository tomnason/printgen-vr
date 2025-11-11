# PrintGEN-VR: A Google Cloud Hackathon Project

This repository contains the source code for PrintGEN-VR, a project built for the Google Cloud Hackathon.

## Project Overview

PrintGEN-VR is a full-stack application that allows users in a Virtual Reality environment to generate 3D models from text and voice prompts. The generated models are then made available for viewing and use within the VR application.

The project leverages a modern, microservices-based architecture on the Google Cloud Platform, demonstrating a secure, scalable, and cost-effective solution for deploying GPU-intensive machine learning workloads.

## Core Features

*   **Speech-to-Text:** Users can speak a prompt, which is transcribed into text using Google Cloud's Speech-to-Text API.
*   **Text-to-3D:** The text prompt is sent to a backend service that uses the OpenAI Shap-E model to generate a 3D model (`.glb` and `.stl` formats).
*   **VR Integration:** The generated model is served via a public URL and can be loaded directly into the VR frontend application for viewing.

## Technology Stack

This project was built using the following Google Cloud services and technologies:

*   **Backend & Compute:**
    *   **Cloud Run:** Hosts the two backend microservices (the GPU-powered `shap-e-api` and the lightweight `auth-api`).
    *   **Cloud Build:** Automates the process of building production-ready Docker images.
    *   **Artifact Registry:** Securely stores the project's Docker container images.

*   **AI & Machine Learning:**
    *   **OpenAI Shap-E:** The core model for 3D generation, running on a GPU-enabled Cloud Run instance.
    *   **Cloud Speech-to-Text API:** Provides fast and accurate voice transcription.

*   **Storage:**
    *   **Cloud Storage:** Stores and serves the generated 3D model files.

*   **Frontend & Hosting:**
    *   **Firebase Hosting:** Deploys and serves the Vite-based VR frontend on a global CDN.

*   **Security:**
    *   **IAM & Service Accounts:** Implements the principle of least privilege by using dedicated, role-based service accounts for each microservice.

---
*This project was created for the Google Cloud Hackathon.*