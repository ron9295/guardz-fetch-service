import { ApiProperty } from '@nestjs/swagger';

class UserDto {
    @ApiProperty({
        description: 'UUID of the user',
        example: '123e4567-e89b-12d3-a456-426614174000'
    })
    id: string;

    @ApiProperty({
        description: 'Email address of the user',
        example: 'user@example.com'
    })
    email: string;

    @ApiProperty({
        description: 'Full name of the user',
        example: 'John Doe'
    })
    name: string;
}

export class UserResponseDto {
    @ApiProperty({
        description: 'Success message',
        example: 'User created successfully'
    })
    message: string;

    @ApiProperty({
        description: 'Created user information',
        type: UserDto
    })
    user: UserDto;
}
