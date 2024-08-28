---
title: FAQ
---

##### What is CloudFront Hosting Toolkit?

CloudFront Hosting Toolkit is an open-source command-line tool designed for deploying and managing frontend applications on AWS. It simplifies the process of setting up and maintaining a robust, scalable hosting infrastructure using services like CloudFront, S3, and CodePipeline.

<br />

---

##### Who is CloudFront Hosting Toolkit for?

CloudFront Hosting Toolkit is primarily designed for developers and teams working on frontend projects who want to leverage AWS services for hosting. It's particularly useful for those who need a streamlined deployment process, want to take advantage of CloudFront's global content delivery network, and require features like custom domains and SSL/TLS management.

<br />

---

##### What types of projects are supported?

The toolkit supports a wide range of frontend projects, including:
- Single-page applications (SPAs)
- Static websites
- Progressive web apps (PWAs)
- Projects built with popular frameworks like React, Angular, and Vue.js
- Custom or less common frameworks (via the "bring your own framework" feature)

Additionally, you can easily customize the build and deployment process to suit your specific project requirements.

<br />

---

##### How does the toolkit handle deployments?

CloudFront Hosting Toolkit uses AWS CodePipeline to manage the deployment process. Here's a brief overview:

1. When you push changes to your configured Git repository (or upload a ZIP file for S3-based deployments), it triggers the pipeline.
2. The pipeline pulls your code and runs the build process using AWS CodeBuild.
3. Built artifacts are uploaded to an S3 bucket.
4. A CloudFront distribution is updated to serve the new content.
5. Cache invalidation is performed to ensure users see the latest version.

This process ensures consistent, repeatable deployments with minimal manual intervention.

<br />

---

##### Is custom domain support available?

Yes, CloudFront Hosting Toolkit provides built-in support for custom domains. During the initialization process, you can specify your custom domain, and the toolkit will:

1. Configure your CloudFront distribution to use the custom domain.
2. Automatically provision and associate an SSL/TLS certificate using AWS Certificate Manager.
3. Provide guidance on setting up the necessary DNS records.

This feature allows you to use your own branded domain while still benefiting from CloudFront's global content delivery network.

<br />

---

##### What storage options are available for deployed content?

CloudFront Hosting Toolkit uses Amazon S3 for storing your deployed website content. The toolkit automatically sets up and configures an S3 bucket optimized for website hosting. This approach provides:

- Scalable and reliable storage for your static assets
- Versioning capabilities for easy rollbacks
- Integration with CloudFront for optimized content delivery

The S3 bucket is set up with appropriate permissions and is not directly accessible to the public, enhancing the security of your deployed content.

<br />

---

##### Can I use the toolkit with existing AWS resources?

While CloudFront Hosting Toolkit is designed to set up a complete hosting infrastructure, it also offers flexibility for integration with existing AWS resources:

- You can use an existing S3 bucket for deployments by specifying it during the initialization process.
- If you have an existing CloudFront distribution, you can potentially integrate it with the toolkit (though this may require some manual configuration).
- For more advanced scenarios, you can use the toolkit's CDK constructs to integrate with your existing AWS CDK stacks.

It's recommended to start with a fresh setup if possible, but the toolkit does provide options for working with existing resources when necessary.

<br />

---

##### Is continuous deployment supported?

Yes, CloudFront Hosting Toolkit supports continuous deployment when using GitHub as your source repository. Each push to your configured branch will automatically trigger a new deployment through the AWS CodePipeline set up by the toolkit.

For S3-based deployments, you can achieve continuous deployment by integrating the toolkit's commands into your existing CI/CD processes.

<br />

---

##### How can I contribute to the CloudFront Hosting Toolkit project?

Contributions to CloudFront Hosting Toolkit are welcome! You can contribute in several ways:

1. Fork the [CloudFront Hosting Toolkit repository](https://github.com/awslabs/cloudfront-hosting-toolkit) on GitHub and submit pull requests for new features or bug fixes.
2. Report issues or suggest features using the GitHub issue tracker.
3. Improve the documentation by submitting updates or clarifications.
4. Share your experiences and help other users in the project's discussion forums.

Before contributing, please review the project's contribution guidelines and code of conduct in the repository.

<br />

---

##### Can I use the toolkit for backend deployments?

CloudFront Hosting Toolkit is primarily designed for frontend deployments. However, it can be used as part of a larger deployment strategy that includes backend services:

- You can use the toolkit to deploy the frontend portion of your application.
- For backend services, consider using complementary AWS services like AWS Lambda, Amazon ECS, or Amazon EKS.
- The toolkit's CDK constructs can be integrated into a broader CDK stack that includes both frontend and backend resources.

While the toolkit doesn't directly handle backend deployments, it can be a valuable component in a comprehensive deployment strategy for full-stack applications.