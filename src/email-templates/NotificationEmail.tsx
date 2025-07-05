import React from 'react';
import {
  Body,
  Container,
  Column,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';

interface NotificationEmailProps {
  recipientName?: string;
  title: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
}

export const NotificationEmail: React.FC<NotificationEmailProps> = ({
  recipientName = 'Usuario',
  title,
  content,
  buttonText,
  buttonUrl
}) => {
  const previewText = `${title} - Econecta`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img
              src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png"
              width="50"
              height="50"
              alt="Econecta Logo"
            />
          </Section>
          <Section style={section}>
            <Heading style={h1}>Hola, {recipientName}</Heading>
            <Heading as="h2" style={h2}>{title}</Heading>
            <Text style={text}>{content}</Text>
            
            {buttonText && buttonUrl && (
              <Section style={btnContainer}>
                <Link style={button} href={buttonUrl}>
                  {buttonText}
                </Link>
              </Section>
            )}
          </Section>
          
          <Section style={footer}>
            <Row>
              <Column>
                <Text style={footerText}>
                  © {new Date().getFullYear()} Econecta. Todos los derechos reservados.
                </Text>
              </Column>
            </Row>
            <Row>
              <Column>
                <Text style={footerText}>
                  Si no desea recibir estos correos, puede{' '}
                  <Link href="#" style={footerLink}>
                    cancelar su suscripción
                  </Link>
                  .
                </Text>
              </Column>
            </Row>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#f5f5f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
};

const logoContainer = {
  padding: '20px 0',
  textAlign: 'center' as const,
  backgroundColor: '#22c55e', // Verde de Econecta
};

const section = {
  padding: '0 20px',
};

const h1 = {
  color: '#333',
  fontSize: '26px',
  fontWeight: '700',
  margin: '40px 0 10px',
};

const h2 = {
  color: '#444',
  fontSize: '22px',
  fontWeight: '600',
  margin: '20px 0',
};

const text = {
  color: '#555',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '20px 0',
};

const btnContainer = {
  textAlign: 'center' as const,
  margin: '30px 0',
};

const button = {
  backgroundColor: '#22c55e',
  borderRadius: '6px',
  color: '#fff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0',
  padding: '12px 25px',
  textDecoration: 'none',
};

const footer = {
  margin: '32px 0',
  textAlign: 'center' as const,
  color: '#777',
};

const footerText = {
  fontSize: '12px',
  margin: '5px 0',
  color: '#777',
};

const footerLink = {
  color: '#22c55e',
  textDecoration: 'underline',
};

export default NotificationEmail;
