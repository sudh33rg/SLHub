import {Column,CreateDateColumn,Entity,PrimaryGeneratedColumn,UpdateDateColumn} from 'typeorm';
@Entity('api_accounts') export class ApiAccount {@PrimaryGeneratedColumn() id!:number;@Column() name!:string;@Column() clientId!:string;@Column() clientSecretEncrypted!:string;@Column({default:'configured'}) status!:string;@CreateDateColumn() createdAt!:Date;@UpdateDateColumn() updatedAt!:Date;}
