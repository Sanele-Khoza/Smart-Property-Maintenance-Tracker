import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SPMT API - Service & Property Management Tool',
      version: '3.0.0',
      description: 'Phase 1 Backend API for property maintenance ticket management',
      contact: { name: 'SPMT Dev Team' },
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Development server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            errors: { type: 'array', items: { type: 'object' } },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            surname: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['TENANT', 'PROPERTY_MANAGER', 'SERVICE_PROVIDER', 'SYSTEM_ADMIN'] },
            phone: { type: 'string' },
            status: { type: 'string', enum: ['ACTIVE', 'PENDING', 'DEACTIVATED', 'SUSPENDED'] },
            approved: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Ticket: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            property_id: { type: 'integer' },
            unit_id: { type: 'integer' },
            tenant_id: { type: 'integer' },
            category_id: { type: 'integer' },
            title: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'] },
            status: { type: 'string' },
            assigned_to_id: { type: 'integer' },
            assigned_to_name: { type: 'string' },
            source: { type: 'string' },
            due_date: { type: 'string', format: 'date-time' },
            created_by_date: { type: 'string', format: 'date-time' },
          },
        },
        Property: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            type: { type: 'string' },
            status: { type: 'string' },
            address: { type: 'string' },
          },
        },
        Unit: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            property_id: { type: 'integer' },
            unit_number: { type: 'string' },
            floor: { type: 'string' },
            type: { type: 'string' },
            status: { type: 'string' },
            bedrooms: { type: 'integer' },
            bathrooms: { type: 'integer' },
            size_sqm: { type: 'number' },
            monthly_rent: { type: 'number' },
            occupant_id: { type: 'integer' },
          },
        },
        Technician: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            company_name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            specialisations: { type: 'array', items: { type: 'string' } },
            rating: { type: 'number' },
            availability_status: { type: 'string' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            recipient: { type: 'string' },
            type: { type: 'string' },
            message: { type: 'string' },
            read: { type: 'boolean' },
            is_emergency: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            sender_id: { type: 'integer' },
            receiver_id: { type: 'integer' },
            subject: { type: 'string' },
            body: { type: 'string' },
            read: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Document: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            type: { type: 'string' },
            file_url: { type: 'string' },
            uploaded_by: { type: 'integer' },
            uploaded_at: { type: 'string', format: 'date-time' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            icon: { type: 'string' },
            color: { type: 'string' },
          },
        },
      },
    },
    paths: {},
  },
  apis: ['./src/modules/**/*.routes.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
