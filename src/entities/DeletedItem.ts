import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User";

export type DeletedItemType = "transaction" | "account" | "budget" | "category";

@Entity("deleted_items")
@Index(["userId", "deletedAt"])
export class DeletedItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 50 })
  itemType!: DeletedItemType;

  @Column({ length: 255 })
  title!: string;

  @Column({ type: "jsonb" })
  data!: any;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column()
  userId!: number;

  @CreateDateColumn()
  deletedAt!: Date;
}
