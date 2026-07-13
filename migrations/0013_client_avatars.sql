-- Foto de perfil dos clientes: aponta logo_url para o arquivo em public/images/clients/.
-- O gestor coloca a logo com o nome do slug; o sistema comprime para 256x256.
UPDATE clients SET logo_url = '/images/clients/maria-maria.png' WHERE slug = 'maria-maria';
UPDATE clients SET logo_url = '/images/clients/aki-sushi.png' WHERE slug = 'aki-sushi';
